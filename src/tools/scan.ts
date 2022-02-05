/* eslint-disable no-await-in-loop */
import { Command } from 'commander';
import { db } from '../database/database';
import { getAllProject, Project, saveProject } from '../database/project.db';
import * as fs from 'fs/promises';
import { REPOSITORIES_PATH, resolveLocalRepositoryName } from '../helpers/helper';

interface ScanArguments {
    local: boolean;
    db: boolean;
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();
    const args = extractScanArguments();
    if (args.local) {
        console.log('🧹 Cleaning local db project');
        const projects = await getAllProject();
        await Project.destroy({ where: {} });
        await scanLocalRepositories(projects);
    }
    if (args.db) {
        console.log('🧹 Cleaning unsaved local project');
        await cleanUnconsistancyDBLocal();
    }
    console.log('🏁 End of scan');
    process.exit(0);
})();

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

async function scanLocalRepositories(dbProjects: Project[]): Promise<void> {
    const localRepositories: string[] = await fs.readdir(REPOSITORIES_PATH);
    for (const localRepo of localRepositories) {
        const repositoryPath = `${REPOSITORIES_PATH}/${localRepo}`;
        const detailsPath = `${repositoryPath}/details.json`;
        const file = await fs.readFile(detailsPath, 'utf8').catch(() => null);
        if (!file) {
            continue;
        }
        const details = JSON.parse(file);
        if (Object.keys(details).length <= 1) {
            continue;
        }
        const dbProject = dbProjects.find((project: Project) => project.id === details.id);
        if (dbProject) {
            await Project.create(dbProject);
        } else {
            await saveProject(details);
        }
        process.stdout.write(`\r Pendings scanning local repositories: ${localRepositories.indexOf(localRepo)}/${localRepositories.length}`);
    }
}

async function cleanUnconsistancyDBLocal(): Promise<void> {
    const localRepositories: string[] = await fs.readdir(REPOSITORIES_PATH);
    const dbProjects = await getAllProject();
    const dbRepositorires: string[] = dbProjects.map((project: Project) => resolveLocalRepositoryName(project));
    
    const unsavedLocalRepositories = localRepositories.filter((localRepository: string) => !dbRepositorires.includes(localRepository));
    console.log(`Unsaved local repositories: ${unsavedLocalRepositories.length}`);
    const tasks = unsavedLocalRepositories.map((repository: string) => {
        return fs.rmdir(`${REPOSITORIES_PATH}/${repository}`, { recursive: true });
    });
    await Promise.all(tasks);

    const unsavedDBRepositories = dbProjects.filter((project: Project) => !localRepositories.includes(resolveLocalRepositoryName(project)));
    console.log(`Unsaved db repositories: ${unsavedDBRepositories.length}`);
    const tasks2 = unsavedDBRepositories.map((repository: Project) => {
        return Project.destroy({ where: { id: repository.id } });
    });
    await Promise.all(tasks2);
}