import * as path from "path";
import { Dirent, PathLike } from "fs";
import fs from "fs/promises";
import { db, getAllRepository, Repository } from "./database";

export const ROOT_PATH = path.resolve(__dirname,'../..');
console.log(ROOT_PATH);
export const REPOSITORIES_PATH = path.resolve(ROOT_PATH,'repositories');
export const CATEGORIES = ['native', 'react', 'vue'];

/**
 * Formats log messages to handle GitHub's repository names
 * Example : 101085586-limit_login_to_ip| ❌ No package.json found
 * @param repositoryGithub
 * @param message
 * @param optionalParams
 */
export function formattedLog(repositoryGithub: string,message?: any, ...optionalParams: any[]) {
    const formattedRepositoryName = repositoryGithub
        .slice(0,repositoryGithub.lastIndexOf("-"))
        .slice(0,15);
    console.log(`${formattedRepositoryName.padEnd(15)}| ${message}`, ...optionalParams);
}

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

/**
 * Clean the database and downloaded repositories
 */
export async function reset() {
    //Delete repositories folder
    const folderContent = await fs.readdir(REPOSITORIES_PATH, { withFileTypes: true });
    folderContent
        .filter((item) => item.isDirectory())
        .map((item) => fs.rm( path.resolve(REPOSITORIES_PATH, item.name), {recursive: true}));
    //Delete from database
    await db.sync({force: true});
}

export async function getRepositoriesFromLocalFiles(): Promise<Dirent[]> {
    const localRepositories = (await fs.readdir(path.resolve(REPOSITORIES_PATH), { withFileTypes: true }))
        .filter((dirent) => dirent.isDirectory());
    return localRepositories;
}

export function resolveProjectDirectoryName(repo: Repository): string {
    return `${repo.name}_${repo.id}`;
}

export function resolveProjectDirectoryPath(repo: Repository): string {
    return path.resolve(REPOSITORIES_PATH, resolveProjectDirectoryName(repo));
}

export async function clearAvortedClonningRepositories(){
    const localRepositories = await getRepositoriesFromLocalFiles();
    const repositoriesInDatabase = await getAllRepository();
    const repositoriesToDeleteInLocal = localRepositories
    .filter((localRepository) => !repositoriesInDatabase.find((repository) => localRepository.name === resolveProjectDirectoryName(repository)));
    
    await Promise.all(repositoriesToDeleteInLocal.map(async (repository) => {
        console.log(`Deleting ${repository.name} in local`);
        // await repository.destroy();
        await fs.rm( path.resolve(REPOSITORIES_PATH, repository.name), {recursive: true});
    }));
    
    const repositoriesToDeleteInDB = repositoriesInDatabase
    .filter((repository) => !localRepositories.find((localRepository) => localRepository.name === resolveProjectDirectoryName(repository)));
    await Promise.all(repositoriesToDeleteInDB.map(async (repository) => {
        console.log(`Deleting ${repository.name} in DB`);
        await repository.destroy();
    }));
}

export async function extractDependenciesFromPackageJSON(packagePath: PathLike): Promise<Record<string, string>> {
    const rowData = await fs.readFile(packagePath, "utf8");
    let packageJSON: Record<string, any> = {};
    try {
        packageJSON = JSON.parse(rowData);
    } catch (e) {
        console.log(`❌ Error parsing package.json: ${e}`);
    }
    const dependencies = packageJSON.dependencies;
    return dependencies;
}