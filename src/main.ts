
import * as path from 'path';
import fs from 'fs/promises';
import pLimit from 'p-limit';
import { PathLike } from 'fs';
import { Command } from 'commander';
import {
    getDependencies,
    getFilesFromDirectory,
    hasDependency, removeDirectory,
    removeDuplicates,
    REPOSITORIES_PATH,
} from './helpers/helper';
import { db, getAllRepository, insertRepository } from "./database/database";


import { getAllProject } from './database/project.db';


const limit = pLimit(10);

interface Arguments {
    query: string;
    limit: number;
    rmFolders: boolean;
}
function extractArguments(): Arguments {
    const program = new Command();
    program
        .description('Retrieves and clones projects from GitHub according to the query options')
        .version('0.0.1')
        .option('--query <string>', 'Query term in package.json', 'webpack,angular,react,vue,express,nestjs,next')
        .option('--limit <number>', 'Limit the number of repositories to download', '500')
        .option('--rmFolders', 'Remove folders after it has been analyzed')
        .parse(process.argv);

    const options = program.opts();
    return {
        query: options.query,
        limit: options.limit,
        rmFolders: options.rmFolders,
    };
}


/**
 * Check if a repository use eslint
 * @param localRepositoryPath
 * @param dependencies
 */
 async function isESLintProject(localRepositoryPath: PathLike, dependencies: Record<string,string>): Promise<boolean>{
    const files = await getFilesFromDirectory(localRepositoryPath);
    const isContainESLintFile = files.find((file) => path.basename(file).match("eslintrc"));
    const packageJsonAsEslint = dependencies.hasOwnProperty("eslint")
    return !!isContainESLintFile || packageJsonAsEslint;
}

/**
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const args = extractArguments();
    await db.sync();

    //Fetch repos mixed between different libraries
    const libraries = args.query.split(',');
    const perLibrary = Math.floor(args.limit / libraries.length);
    let repositories = [];
    for (const library of libraries) {
        // eslint-disable-next-line no-await-in-loop
        repositories.push(...await retrieveRepositoriesFromGithub(library, perLibrary, {}));
    }
    repositories = removeDuplicates(repositories);

    let endedFetching: number = 0;
    process.stdout.write(`Processing...`);
    const processActions: Promise<string | void>[] = repositories.map((repo: any) => limit(() => downloadRepository(repo, !args.rmFolders))
        .then(async (path: string) => {
            endedFetching++;

            const dependencies = await getDependencies(repo.name, path).catch(() => { return {} });
            const hasDependencies = Object.keys(dependencies).length;

            const category = foundCategory(dependencies);

            const isWebpack = isWebpackRepository(dependencies, category);

            if (isWebpack) {
                await insertRepository({
                    id: repo.id,
                    owner: repo.owner.login,
                    name: repo.name,
                    language: repo.language,
                    forks: repo.forks_count,
                    stars: repo.stargazers_count,
                    contributors: await getNbContributors(repo),
                    category: category,
                    ruleLinter: hasDependencies ? await isESLintProject(path, dependencies) : false,
                    ruleDevDependencies: hasDependencies ? await checkWrongPlaceForDependencies(path, dependencies) : 0,
                    createdAt: repo.created_at,
                    updatedAt: repo.updated_at,
                })
            }

            if (!isWebpack || args.rmFolders) {
                await removeDirectory(path);
            }

            process.stdout.write(`\rProcessing... ${endedFetching}/${repositories.length}`);
        }));
    await Promise.all(processActions);

    console.log('\nDone!');
})();

*/