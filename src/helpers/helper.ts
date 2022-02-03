import * as path from "path";
import { PathLike } from "fs";
import fs from "fs/promises";

export const ROOT_PATH = path.resolve(__dirname,'../..');
export const REPOSITORIES_PATH = path.resolve(ROOT_PATH,'repositories');


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
export async function parsePackageJSON(packagePath: PathLike): Promise<Record<string, string>> {
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

/**
 * Get repository dependencies
 * @param projectName
 * @param repoPath
 */
export async function getDependencies(projectName: string, repoPath: PathLike): Promise<Record<string, string>> {
    const packageJSONPath = await findPackageJSONPath(repoPath);
    if (!packageJSONPath) {
        throw new Error('package.json not found')
    }
    return await parsePackageJSON(packageJSONPath);
}

/**
 * Remove duplicates from array of objects
 */
export function removeDuplicates(array: any[]) {
    return Array.from(new Set(array));
}