import { Command } from 'commander';
import { db } from '../database/database';
import { getAllProject, Project, saveProject } from '../database/project.db';
import * as fs from 'fs/promises';
import { REPOSITORIES_PATH } from '../helpers/helper';

const concurrentDownloads = 50;

interface ScanArguments {
    local: boolean;
    db: boolean;
}
function extractScanArguments(): ScanArguments {
    const program = new Command();
    program
        .description('Retrieves and clones projects from GitHub according to the query options')
        .version('0.0.1')
        .option('--local', 'Clean db and use LOCAL as source of truth', false)
        .option('--db', 'Use DB as source of truth and delete local unused package', false)
        .parse(process.argv);

    const options = program.opts();
    if (options.local && options.db) {
        throw new Error('You cannot use --local and --db at the same time');
    }
    if (!options.local && !options.db) {
        throw new Error('You must use --local or --db');
    }
    return {
        local: options.local,
        db: options.db,
    };
}

async function scanLocalRepositories(): Promise<void> {
    const localRepositories: string[] = await fs.readdir(REPOSITORIES_PATH);
    const tasks = localRepositories.map(async (repository: string) => {
        const repositoryPath = `${REPOSITORIES_PATH}/${repository}`;
        const detailsPath = `${repositoryPath}/details.json`;

        const details = JSON.parse(await fs.readFile(detailsPath, 'utf8'));
        await saveProject(details);
    });
    await Promise.all(tasks);
}

function resolveLocalRepositoryName(project: Project): string {
    return `${project.name}_${project.id}`;
}

async function cleanUnconsistancyDBLocal(): Promise<void> {
    const localRepositories: string[] = await fs.readdir(REPOSITORIES_PATH);
    const dbProjects = await getAllProject();
    const dbRepositorires: string[] = dbProjects.map((project: Project) => resolveLocalRepositoryName(project));
    
    const unsavedLocalRepositories = localRepositories.filter((localRepository: string) => dbRepositorires.includes(localRepository));

    const tasks = unsavedLocalRepositories.map((repository: string) => {
        return fs.rmdir(`${REPOSITORIES_PATH}/${repository}`, { recursive: true });
    });
    await Promise.all(tasks);

    const unsavedDBRepositories = dbProjects.filter((project: Project) => localRepositories.includes(resolveLocalRepositoryName(project)));
    const tasks2 = unsavedDBRepositories.map((repository: Project) => {
        return Project.destroy({ where: { id: repository.id } });
    });
    await Promise.all(tasks2);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();
    const args = extractScanArguments();
    if (args.local) {
        console.log('🧹 Cleaning local db project');
        await Project.destroy({ where: {} });
        await scanLocalRepositories();
    }
    if (args.db) {
        console.log('🧹 Cleaning unsaved local project');
        await cleanUnconsistancyDBLocal();
    }
    process.exit(0);
})();
