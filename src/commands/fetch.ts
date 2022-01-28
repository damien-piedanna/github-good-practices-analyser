import { Octokit } from '@octokit/rest';
import * as path from 'path';
import gitClone from 'git-clone/promise';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { Command } from 'commander';
import {clearAvortedClonningRepositories, REPOSITORIES_PATH, reset} from '../tools/helper';
import {db, getAllRepository, insertRepository} from "../tools/database";

const octokit = new Octokit();

interface Arguments {
    query: string;
    limit: number;
    reset: boolean;
    clean: boolean;
}
function extractArguments(): Arguments {
    const program = new Command();
    program
        .description('Retrieves and clones projects from GitHub according to the query options')
        .version('0.0.1')
        .option('--query <string>', 'Query term in package.json', 'webpack')
        .option('--limit <number>', 'Limit the number of repositories to download', '10')
        .option('--reset', 'Clean the database and downloaded repositories before fetch')
        .option('--clean', 'Clean the local repositories if they are not in DB')
        .parse(process.argv);

    const options = program.opts();
    return {
        query: options.query,
        limit: options.limit,
        reset: options.reset,
        clean: options.clean,
    };
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
 * Retrieve repositories from GitHub
 * @link Example: https://github.com/search?q=webpack+in%3Apackage.json+language%3Ajavascript+archived%3Afalse+is%3Apublic&type=Repositories
 * @param termInPackageJson - Search for projects containing this term in package.json
 * @param limit - Limit of projects wanted
 */
async function retrieveRepositoriesFromGithub(termInPackageJson: string, limit: number): Promise<any> {
    //Optimization if limit > PER_PAGE_MAX
    const alreadyLoadedRepositories = await getAllRepository();

    const repositories: any[] = [];
    process.stdout.write(`\rRetrieve from Github... ${repositories.length}/${limit}`);
    let page = 1;
    while (repositories.length < limit) {
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
        process.stdout.write(`\rRetrieve from Github... ${repositories.length}/${limit}`);
        page++;
    }
    console.log('');
    return repositories;
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
    await db.sync();

    if(args.clean){
        console.log('Clean avorted clonning repositories');
        await clearAvortedClonningRepositories();
    }

    if (args.reset) {
        console.log('Reset...');
        await reset();
    }

    const repositories = await retrieveRepositoriesFromGithub(args.query, args.limit);


    let endedClonning: number = 0;
    process.stdout.write(`Cloning...`);
    
    const cloneActions: Promise<string>[] = repositories.map((repo: any) => cloneRepository(repo)
    .then(async () => {   
        endedClonning++;
        process.stdout.write(`\rCloning... ${endedClonning}/${repositories.length}`);
        await saveRawRepository(repo);
    }));

    await Promise.all(cloneActions);

    console.log('Done!');
})();

