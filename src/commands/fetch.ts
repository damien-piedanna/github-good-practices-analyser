import { Octokit } from '@octokit/rest';
import * as path from 'path';
import gitClone from 'git-clone/promise';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { Command } from 'commander';
import { REPOSITORIES_PATH, reset } from '../tools/helper';
import { db, insertRepository } from "../tools/database";

const octokit = new Octokit();
const PER_PAGE_MAX = 100;

interface Arguments {
    query: string;
    limit: number;
    reset: boolean;
}
function extractArguments(): Arguments {
    const program = new Command();
    program
        .description('Retrieves and clones projects from GitHub according to the query options')
        .version('0.0.1')
        .option('--query <string>', 'Query term in package.json', 'webpack')
        .option('--limit <number>', 'Limit the number of repositories to download', '10')
        .option('--reset', 'Clean the database and downloaded repositories before fetch')
        .parse(process.argv);

    const options = program.opts();
    return {
        query: options.query,
        limit: options.limit,
        reset: options.reset,
    };
}

/**
 * Retrieve repositories from GitHub
 * @link Example: https://github.com/search?q=webpack+in%3Apackage.json+language%3Ajavascript+archived%3Afalse+is%3Apublic&type=Repositories
 * @param termInPackageJson - Search for projects containing this term in package.json
 * @param limit - Limit of projects wanted
 */
async function retrieveRepositoriesFromGithub(termInPackageJson: string, limit: number): Promise<any> {
    //Building query pool
    const queryParams: any[] = [];
    //Optimization if limit > PER_PAGE_MAX
    const perPage = limit > PER_PAGE_MAX ? PER_PAGE_MAX : limit;
    const nbPageNeeded = Math.ceil(limit / perPage);
    for(let page = 1; page <= nbPageNeeded; page++){
        queryParams.push({
            'termInPackageJson': termInPackageJson,
            'per_page': perPage,
            'page': page,
        });
    }

    //Execute Queries
    const queryActions = queryParams.map(githubCall);
    let results = await Promise.all(queryActions);

    //Cleaning data
    results = results.map(a => a.data.items).flat().slice(0, limit);

    return results;
}

/**
 * Execute github HTTP GET request
 * @param params
 */
function githubCall(params: any): Promise<any> {
    return octokit.rest.search.repos({
        q: params.termInPackageJson + '+in:package.json+language:javascript+archived:false+is:public',
        sort: 'updated',
        order: 'desc',
        per_page: params.per_page,
        page: params.page,
    });
}

/**
 * Clone a repository in the right path
 * @param repo - Repository object return by Github's API
 */
async function cloneRepository(repo: any): Promise<string> {
    const repoPath = path.resolve(REPOSITORIES_PATH, `${repo.name}_${repo.id}`);

    const isAlreadyClone = existsSync(repoPath);
    if (!isAlreadyClone) {
        await fs.mkdir(repoPath, { recursive: true });
        await fs.writeFile(path.resolve(repoPath, 'details.json'), JSON.stringify(repo, null, 2));
        await gitClone(repo.clone_url, path.resolve(repoPath, 'source'));
    }

    return repoPath;
}

/**
 * Save a repository
 * @param repo - Repository object return by Github's API
 */
async function saveRawRepository(repo: any): Promise<void> {
    await insertRepository({id: repo.id, name: repo.name, status: 'uncategorized', category: ''})
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const args = extractArguments();

    if (args.reset) {
        console.log('Reset...');
        await reset();
    }

    console.log('Retrieve from github...');
    const repositories = await retrieveRepositoriesFromGithub(args.query, args.limit);

    console.log('Cloning...');
    const cloneActions: Promise<string>[] = repositories.map(cloneRepository);
    await Promise.all(cloneActions);

    console.log('Saving...');
    await db.sync();
    const saveActions: Promise<string>[] = repositories.map(saveRawRepository);
    await Promise.all(saveActions);

    console.log('Done!');
})();

