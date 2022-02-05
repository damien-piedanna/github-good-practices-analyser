
import * as path from 'path';
import { PathLike } from 'fs';
import {
    getFilesFromDirectory,
} from './helpers/helper';

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