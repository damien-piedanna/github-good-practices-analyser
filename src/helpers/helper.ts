import * as path from "path";
import { PathLike } from "fs";
import fs from "fs/promises";
import { Project } from "../database/project.db";
import { Octokit } from "@octokit/rest";

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
        return stat.isDirectory() && !stat.isSymbolicLink() ? getFilesFromDirectory(res) : [res];
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
export async function findFile(name: string, dir: PathLike): Promise<string | null> {
    const files = await getFilesFromDirectory(dir);
    const found = files.find((file) => file.endsWith(name));
    return found ?? null;
}

/**
 * Fin package.json in a directory
 * @param repoPath
 */
export async function findPackageJSONPath(repoPath: PathLike): Promise<PathLike | null> {
    return await findFile("package.json", repoPath);
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
        console.log(`❌ Error parsing package.json: ${e}`);
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
    const packageJSONPath = await findPackageJSONPath(repoPath);
    if (!packageJSONPath) {
        throw new Error(project.name + ' package.json not found');
    }
    return parsePackageJSON(packageJSONPath).catch();
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
        console.log(error.response.headers['x-ratelimit-reset']);
        process.stdout.write('\n');
        let delay = 240;
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