import * as path from "path";
import fs from "fs/promises";
import {
    CATEGORIES,
    findPackageJSONPath,
    formattedLog,
    getFilesFromDirectory,
    REPOSITORIES_PATH,
} from "../tools/helper";
import { PathLike } from "fs";
import { Command, Option } from "commander";
import {
    db, getRepositoriesByStatus, getRepositoriesByStatusAndCategory,
    Repository
} from "../tools/database";

interface Arguments {
    category: string;
}
function extractArguments(): Arguments {
    const program = new Command();
    program
        .description('Analyze good project practices according to WebPack')
        .version('0.0.1')
        .addOption(new Option('-c, --category <string>', 'Category to be analyzed').choices(['all', ...CATEGORIES]).default('all'))
        .parse(process.argv);

    const options = program.opts();
    return {
        category: options.category,
    };
}

async function countDependencies() {
    const localRepositories = await getAllRepository();
    const packageJSONPromises = localRepositories.map(async (repository) => {
        const packageJSONPath = await findPackageJSONPath(path.resolve(REPOSITORIES_PATH, resolveProjectDirectoryName(repository)));
        if (!packageJSONPath) {
            formattedLog(repository.name,`❌ No package.json found`);
            return;
        }
        const rowData = await fs.readFile(packageJSONPath, "utf8");
        let packageJSON: Record<string, any> = {};
        try {
            packageJSON = JSON.parse(rowData);
        } catch (e) {
            console.log(`❌ Error parsing package.json: ${e}`);
        }
        const dependencies = packageJSON.dependencies;
        const devDependencies = packageJSON.devDependencies;
        return {
            dependencies: dependencies,
            devDependencies: devDependencies,
        };
    });
    const packageJSONs = await Promise.all(packageJSONPromises);
    const dependenciesCounter: Map<string,number> = new Map();
    const devDependenciesCounter: Map<string,number> = new Map();
    packageJSONs.forEach((packageJSON) => {
        const keyDependencies = Object.keys(packageJSON?.dependencies ?? {});
        if (keyDependencies?.length > 0) {
            keyDependencies.map((dependency: string) => {
                dependenciesCounter.set(dependency, (dependenciesCounter.get(dependency) ?? 0) + 1);
            });
        }
        
        const keyDevDependencies = Object.keys(packageJSON?.devDependencies ?? {});
        if (keyDevDependencies?.length > 0) {
            keyDevDependencies.map((dependency: string) => {
                devDependenciesCounter.set(dependency, (devDependenciesCounter.get(dependency) ?? 0) + 1);
            });
        }
    });
    
    console.log(Array.from(dependenciesCounter).sort((a, b) => b[1] - a[1]));
    console.log(Array.from(devDependenciesCounter).sort((a, b) => b[1] - a[1]));
}

async function isESLintProject(localRepositoryPath: PathLike): Promise<boolean>{
    const files = await getFilesFromDirectory(localRepositoryPath);
    const isContainESLintFile = files.find((file) => path.basename(file).match("eslintrc"));
    return !!isContainESLintFile;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();
    const args = extractArguments();

    let repositories: Repository[];
    if (args.category == 'all') {
        console.log('Fetching categorized repositories...');
        repositories = await getRepositoriesByStatus('categorized');
    } else {
        console.log('Fetching ' + args.category + ' repositories...');
        repositories = await getRepositoriesByStatusAndCategory('categorized', args.category);
    }

    console.log(repositories.length + " project(s) found!");
})();
