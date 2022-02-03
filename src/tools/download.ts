import { Command } from 'commander';
import { downloadRepository, retrieveRepositoriesFromGithub } from '../main';
import { db } from './database';
import { saveProject } from './project.db';

const concurrentDownloads = 50;

interface DownloadArguments {
    query: string;
    limit: number;
}
function extractDownloadArguments() {
    const program = new Command();
    program
        .description('Retrieves and clones projects from GitHub according to the query options')
        .version('0.0.1')
        .option('--query <string>', 'Query term in package.json', 'webpack')
        .option('--limit <number>', 'Limit the number of repositories to download', '1000')
        .parse(process.argv);

    const options = program.opts();
    return {
        query: options.query,
        limit: options.limit,
        rmFolders: options.rmFolders,
    };
}

async function multiDownloadRepo(repos: any[]): Promise<any> {
    function recursiveLoopingDownload(repositoriesStackTask: any[], repo: any): Promise<any> {
        return downloadRepository(repo, true)
        .catch((_err) => {
            ended++;
            console.log('📥 Downloading project failed');
        }) 
        .then(async () => {
            await saveProject(repo);
        })
        .finally(async () => {
            ended++;
            process.stdout.write(`\r📥 Processing...   ${ended}/${repos.length}`);
            const nextRepo = repositoriesStackTask.pop();
            if (nextRepo) {
                await recursiveLoopingDownload(repositoriesStackTask, nextRepo);
            }
        });
    }
    console.log(`\n📥 Downloading ${repos.length} repositories`);
    let ended = 0;
    process.stdout.write(`\r📥 Processing...   ${ended}/${repos.length}`);

    const repositoriesStackTask = [...repos];
    const downloadTask = [];
    while (downloadTask.length < concurrentDownloads && repositoriesStackTask.length > 0) {
        downloadTask.push(recursiveLoopingDownload(repositoriesStackTask, repositoriesStackTask.pop()));
    }
    await Promise.all(downloadTask);

    process.stdout.write(`\n📥 Processing...   ${ended}/${repos.length} ended✅`);
    return;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();
    const args = extractDownloadArguments();
    const repositories = await retrieveRepositoriesFromGithub(args.query, args.limit, {});
    await multiDownloadRepo(repositories);

    process.exit(0);
})();
