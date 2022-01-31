import { Octokit } from '@octokit/rest';
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
} from './tools/helper';
import { db, getAllRepository, insertRepository } from "./tools/database";
import * as dotenv from "dotenv";
import AdmZip from "adm-zip";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});
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
 * Retrieve repositories from GitHub
 * @link Example: https://github.com/search?q=webpack+in%3Apackage.json+language%3Ajavascript+archived%3Afalse+is%3Apublic&type=Repositories
 * @param termInPackageJson - Search for projects containing this term in package.json
 * @param limit - Limit of projects wanted
 */
async function retrieveRepositoriesFromGithub(termInPackageJson: string, limit: number): Promise<any> {
    //Optimization if limit > PER_PAGE_MAX
    const alreadyLoadedRepositories = await getAllRepository();

    const repositories: any[] = [];
    process.stdout.write(`\rRetrieve ${termInPackageJson} lib from Github... ${repositories.length}/${limit}`);
    let page = 1;
    // Max result is 1000
    while (repositories.length < limit && page <= 10) {
        // eslint-disable-next-line no-await-in-loop
        const githubResponse = await githubCall({
            termInPackageJson: termInPackageJson,
            per_page: 100,
            page: page,
        });
        //Cleaning data
        const queryRepositories = githubResponse.data.items
            .flat()
            .filter((repo: any) => !(alreadyLoadedRepositories.find((r: any) => r.id === repo.id)))
            .slice(0, limit - repositories.length);

        repositories.push(...queryRepositories);
        process.stdout.write(`\rRetrieve ${termInPackageJson} lib from Github... ${repositories.length}/${limit}`);
        page++;
    }
    console.log('');
    return repositories;
}

/**
 * Execute github HTTP GET request
 * @param params
 */
function githubCall(params: any): Promise<any> {
    return octokit.rest.search.repos({
        q: params.termInPackageJson + '+in:package.json+language:javascript+language:typescript+archived:false+is:public',
        sort: 'updated',
        order: 'desc',
        per_page: params.per_page,
        page: params.page,
    }).catch(async (error: any) => {
        console.log(error);
        process.stdout.write('\n');
        let delay = 70;
        while(delay > 0) {
            process.stdout.write(`\rAPI rate limit exceeded waiting ${delay} seconds`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 1000));
            delay--;
        }
        return githubCall(params);
    });
}

/**
 * Return number of contributors for a repository
 * @param repo
 */
async function getNbContributors(repo: any): Promise<number> {
    const res = await octokit.rest.repos.listContributors({
        owner: repo.owner.login,
        repo: repo.name,
        per_page: 100,
    }).catch(async (error: any) => {
        console.log(error);
        process.stdout.write('\n');
        let delay = 70;
        while(delay > 0) {
            process.stdout.write(`\rAPI rate limit exceeded waiting ${delay} seconds`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 1000));
            delay --;
        }
        return getNbContributors(repo);
    });
    if (typeof res != "number") {
        return res.data.length;
    }
    return 1;
}

/**
 * Download a repository in the right path
 * @param repo - Repository object return by Github's API
 * @param saveDetails - Save details to a json
 */
async function downloadRepository(repo: any, saveDetails: boolean): Promise<string> {
    const repoPath = path.resolve(REPOSITORIES_PATH, `${repo.name}_${repo.id}`);

    await fs.mkdir(repoPath, { recursive: true });

    try {
        const repoData = await octokit.rest.repos.downloadZipballArchive({
            owner: repo.owner.login,
            repo: repo.name,
            ref: repo.default_branch,
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const buffer = Buffer.from(repoData.data);
        const zip = new AdmZip(buffer);
        zip.extractAllTo(repoPath,true);
        const sourcePath = await fs.readdir(repoPath);
        await fs.rename(path.resolve(repoPath, sourcePath[0]), path.resolve(repoPath, 'source'));
    } catch (e) {
        console.error(e);
    }

    if (saveDetails) {
        await fs.writeFile(path.resolve(repoPath, 'details.json'), JSON.stringify(repo, null, 2));
    }

    return repoPath;
}

/**
 * Found repository category
 * @param dependencies
 */
function foundCategory(dependencies: Record<string, string>) {
    switch (true) {
        case hasDependency(dependencies, '@angular/core'): {
            return "angular";
        }
        case hasDependency(dependencies, 'vue'): {
            return "vue";
        }
        case hasDependency(dependencies, '@nestjs/core'): {
            return "nestjs";
        }
        case hasDependency(dependencies, 'next'): {
            return "next";
        }
        case hasDependency(dependencies, 'react'): {
            return "react";
        }
        case hasDependency(dependencies, 'express'): {
            return "express";
        }
    }
    return "native";
}

/**
 * Checks the number of misplaced dev dependencies
 * @param localRepositoryPath
 * @param dependencies
 */
async function checkWrongPlaceForDependencies(localRepositoryPath: PathLike, dependencies: Record<string,string>) {
    const devDependenciesFile = JSON.parse((await fs.readFile(path.resolve(__dirname, '../src/info/devDependencies.info.json'))).toString());
    const mostCommonDevDependencies: string[] = devDependenciesFile.mostCommon;
    const wrongDependencies = Object.keys(dependencies ?? {}).filter((dependency) => {
        return mostCommonDevDependencies.includes(dependency);
    });
    /*
    if (wrongDependencies.length) {
        console.log(`${wrongDependencies.join(', ')} should be in devDependencies`);
    }
    */
    return wrongDependencies.length;
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
 * Return if a repository use webpack
 * @param dependencies
 * @param category
 */
function isWebpackRepository(dependencies: Record<string, string> | {}, category: string): boolean {
    if (['angular', 'next', 'vue'].includes(category)) {
        return true;
    }
    return hasDependency(dependencies, 'webpack');
}

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
        repositories.push(...await retrieveRepositoriesFromGithub(library, perLibrary));
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

