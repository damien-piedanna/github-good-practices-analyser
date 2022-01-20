import * as path from "path";
import fs from "fs/promises";
import {CATEGORIES, findFile, formattedLog, getFilesFromDirectory, REPOSITORIES_PATH} from "../helper";
import {PathLike} from "fs";
import {Command, Option} from "commander";

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

async function analyseRepository(projectName: string, repoPath: PathLike): Promise<void> {
    formattedLog(projectName,`Analysing...`);
    const packageJSONPath = await findPackageJSONPath(repoPath);
    if (!packageJSONPath) {
        formattedLog(projectName,`❌ No package.json found`);
        return;
    }
    const packageJSONDependencies = await parsePackageJSON(packageJSONPath);
    if (!isWebpackProject(packageJSONDependencies)){
        formattedLog(projectName,`⚠️  Not a webpack project`);
    }

    if(!(await isESLintProject(repoPath))){
        formattedLog(projectName,`⚠️  Not a ESLint project`);
    }
}

async function findPackageJSONPath(repoPath: PathLike): Promise<PathLike | null> {
    return await findFile("package.json", repoPath);
}

async function parsePackageJSON(packagePath: PathLike): Promise<Record<string, string>> {
    const rowData = await fs.readFile(packagePath, "utf8");
    let packageJSON: Record<string, any> = {};
    try {
        packageJSON = JSON.parse(rowData);
    } catch (e) {
        console.log(`❌ Error parsing package.json: ${e}`);
    }
    const dependencies = packageJSON.dependencies;
    const devDependencies = packageJSON.devDependencies;
    const peerDependencies = packageJSON.peerDependencies;
    const optionalDependencies = packageJSON.optionalDependencies;
    return {...dependencies, ...devDependencies, ...peerDependencies, ...optionalDependencies};
}

function isWebpackProject(packageJSONDependencies: Record<string,string>): boolean{
    if (packageJSONDependencies.hasOwnProperty("webpack")) {
        return true;
    }
    if (packageJSONDependencies.hasOwnProperty("angular")) {
        return true;
    }
    return false;
}

async function isESLintProject(localRepositoryPath: PathLike): Promise<boolean>{
    const files = await getFilesFromDirectory(localRepositoryPath);
    const isContainESLintFile = files.find((file) => path.basename(file).includes("eslintrc"));
    return !!isContainESLintFile;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const args = extractArguments();

    const localRepositories = (await fs.readdir(path.resolve(REPOSITORIES_PATH), { withFileTypes: true }))
        .filter((dirent) => dirent.isDirectory());

    const tasks = new Array<Promise<any>>();
    for (const localRepository of localRepositories) {
        tasks.push(analyseRepository(localRepository.name, path.resolve(REPOSITORIES_PATH,localRepository.name,'source')));
    }
    await Promise.all(tasks);
})();
