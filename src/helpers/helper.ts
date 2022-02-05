import * as path from "path";
import { PathLike } from "fs";
import fs from "fs/promises";
import { Project } from "../database/project.db";
import { Octokit } from "@octokit/rest";
import pLimit from "p-limit";

export const ForbiddenDirectory = ['node_modules','dist']; 

export const ROOT_PATH = path.resolve(__dirname,'../..');
export const REPOSITORIES_PATH = path.resolve(ROOT_PATH,'repositories');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

/**
 * Get all files from directory
 * @param dir - directory path
 */
export async function getFilesFromDirectory(dir: PathLike): Promise<string[]> {
    const subDirs = await fs.readdir(dir);
    const files = await Promise.all(subDirs.map(async (subdir) => {
        const res = path.resolve(dir.toLocaleString(), subdir);
        const stat = await fs.lstat(res);
        return stat.isDirectory() && !ForbiddenDirectory.includes(path.basename(res)) && !stat.isSymbolicLink() ? getFilesFromDirectory(res) : [res];
    }));
    if( files.length === 0 ){
        return [];
    }
    return files.reduce((a, f) => a.concat(f, []));
}


export function resolveLocalRepositoryName(project: Project): string {
    return `${project.name}_${project.id}`;
}


/**
 * Find a file in a directory
 * @param name - File name
 * @param dir - File directory
 */
async function findFile(name: string | RegExp, dir: PathLike): Promise<string[]> {
    const filePaths = await getFilesFromDirectory(dir);
    const found = filePaths.filter((file) => path.basename(file).match(name));
    return found;
}

/**
 * Fin package.json in a directory
 * @param repoPath
 */
export async function findPackageJSONPath(repoPath: PathLike): Promise<PathLike[]> {
    const files = await findFile("package.json", repoPath);
    return files;
}

/**
 * Parse package.json and extract dependencies
 * @param packagePath
 */
export async function parsePackageJSON(
    packagePath: PathLike,
): Promise<{
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
}> {
    const rowData = await fs.readFile(packagePath, 'utf8');
    let packageJSON: Record<string, any> = {};
    try {
        packageJSON = JSON.parse(rowData);
    } catch (e) {
        // console.log(`❌ Error parsing package.json: ${e}`);
    }
    const dependencies = packageJSON.dependencies;
    const devDependencies = packageJSON.devDependencies;
    const peerDependencies = packageJSON.peerDependencies;
    const optionalDependencies = packageJSON.optionalDependencies;
    return {
        dependencies: dependencies,
        devDependencies: devDependencies,
        peerDependencies: peerDependencies,
        optionalDependencies: optionalDependencies,
    };
}

export async function removeDirectory(packagePath: PathLike) {
    try {
        await fs.rm(packagePath, { recursive: true, force: true });
    } catch (e) {
        console.error(e);
    }
}

/**
 * Return if a repository as a dependency
 * @param packageJSONDependencies
 * @param found
 */
export function hasDependency(packageJSONDependencies: Record<string,string>, found: string): boolean {
    return packageJSONDependencies.hasOwnProperty(found)
}

export function resolveLocalPath(project: Project): PathLike {
    return path.resolve(REPOSITORIES_PATH, resolveLocalRepositoryName(project));
}

/**
 * Get repository dependencies
 * @param projectName
 * @param repoPath
 */
export async function getDependencies(project: Project): Promise<Record<string, string>> {
    const dependencies = await getStructuredDependencies(project);
    return { ...dependencies.dependencies, ...dependencies.devDependencies };
}

export async function getStructuredDependencies(
    project: Project,
): Promise<{
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
}> {
    const repoPath = resolveLocalPath(project);
    const packageJSONPaths = await findPackageJSONPath(repoPath);
    if (!packageJSONPaths) {
        throw new Error(project.name + ' package.json not found');
    }
    const packageJSONParseTasks = packageJSONPaths.map((packageJSONPath) =>
        parsePackageJSON(packageJSONPath).catch(() => {
            return {
                dependencies: {},
                devDependencies: {},
                peerDependencies: {},
                optionalDependencies: {},
            };
        }),
    );
    const packageJSONs = await Promise.all(packageJSONParseTasks);
    
    const concatPackageJSON = {
        dependencies: packageJSONs.reduce((a, p) => ({ ...a, ...p.dependencies }), {}),
        devDependencies: packageJSONs.reduce((a, p) => ({ ...a, ...p.devDependencies }), {}),
        peerDependencies: packageJSONs.reduce((a, p) => ({ ...a, ...p.peerDependencies }), {}),
        optionalDependencies: packageJSONs.reduce((a, p) => ({ ...a, ...p.optionalDependencies }), {}),
    };
    return concatPackageJSON;
}

/**
 * Remove duplicates from array of objects
 */
export function removeDuplicates(array: any[]) {
    return Array.from(new Set(array));
}

/**
 * Return number of contributors for a repository
 * @param repo
 */
 export async function getNbContributors(repo: any): Promise<number> {
    const res = await octokit.rest.repos.listContributors({
        owner: repo.owner.login,
        repo: repo.name,
        per_page: 100,
    }).catch(async (error: any) => {
        let delay: number;
        switch (error.status) {
            case 404:
                return -1;
            case 500:
                delay = 30;
                break;
            case 403:
                delay = error?.response?.headers['x-ratelimit-reset'] - (Date.now()/1000);
                break;
            default:
                console.log(error);
                delay = 30;
                break;
        }
        process.stdout.write(`\r⏳ Delay for ${delay.toFixed(0)} seconds`);
        while(delay > 0){
            delay--;
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, 1000));
            process.stdout.write(`\r⏳ Delay for ${delay.toFixed(0)} seconds`);
        }
        return getNbContributors(repo);
    });
    if (typeof res != "number") {
        return res.data.length;
    }
    return 1;
}

export async function countRowOfCode(projectName: string, projectId: string): Promise<number>{
    const repoPath = path.resolve(REPOSITORIES_PATH, `${projectName}_${projectId}`);
    const files = await getFilesFromDirectory(repoPath);
    const filesPath = files
    .filter((file) => file.match(/\.(js|ts|tsx|jsx)$/))
    .map((file) => path.resolve(repoPath, file));
    let nbLignes = 0;
    try {
        const filesLines = await Promise.all(
            filesPath.map((file) =>
                fs
                    .readFile(file, {
                        encoding: 'utf8',
                        flag: 'r',
                    })
                    .catch(() => '')
                    .then((file) => file.split('\n').length),
            ),
        );
        nbLignes = filesLines.reduce((a, b) => a + b, 0);
    } catch (_e) {
        nbLignes = -1;
    }
    return nbLignes;

    
}