import { Octokit } from "@octokit/rest";
import * as path from "path";
import gitClone from "git-clone/promise";
import fs from "fs/promises";
import { existsSync, PathLike } from "fs";
import { Command } from "commander";

const library: string = process.argv[2] ?? "webpack";
const octokit = new Octokit();

const ROOT_PATH = path.resolve(__dirname,'..');
const REPOSITORIES_PATH = path.resolve(ROOT_PATH,'repositories');

/**
 * Fetches repositories from GitHub
 */
async function fetchRepositoriesByLibrary(
    library: string,
    queryParams: {} = {
        sort: "updated",
        order: "desc",
        per_page: 10,
    },
): Promise<any> {
    /**
     * @link https://github.com/search?q=webpack+in%3Apackage.json+language%3Ajavascript+archived%3Afalse+is%3Apublic&type=Repositories
     * @warning package.json may not be located at the root
     */
    const response = await octokit.rest.search.repos({
        q: library + "+in:package.json+language:javascript+archived:false+is:public",
        ...queryParams,
        page: 2,
    });
    const data = response.data;
    const cloneActions: Promise<string>[] = data.items.map(cloneRepository);
    const repositoryPaths = await Promise.all(cloneActions);
}

async function findPackageJSONPath(repoPath: PathLike): Promise<PathLike | null> {
    const packageJSONPaths = await findFile("package.json",repoPath );
    return packageJSONPaths;
}

async function parsePackageJSON(packagePath: PathLike): Promise<Record<string, string>> {
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
    const allDependencies = { ...dependencies, ...devDependencies, ...peerDependencies, ...optionalDependencies };
    return allDependencies;
}

function isWebpackProject(packageJSONDependencies: Record<string,string>): boolean{
    if (packageJSONDependencies.hasOwnProperty("webpack")) {
        return true;
    }
    if (packageJSONDependencies.hasOwnProperty("angular")) {
        return true;
    }
    return false;
}

async function isESLintProject(localRepositoryPath: PathLike): Promise<boolean>{
    const files = await getFiles(localRepositoryPath);
    const isContaintESLintFile = files.find((file) => path.basename(file).includes("eslintrc"));
    return !!isContaintESLintFile;
}


/**
 * Formats log messages to handle GitHub's repository names
 * Example : 101085586-limit_login_to_ip| ❌ No package.json found
 */
function formatedLog(repositoryGithub: string,message?: any, ...optionalParams: any[]){
    const formattedRepositoryName = repositoryGithub
    .slice(0,repositoryGithub.lastIndexOf("-"))
    .slice(0,15);
    console.log(`${formattedRepositoryName.padEnd(15)}| ${message}`, ...optionalParams);
}

async function analyseRepository(repoPath: PathLike): Promise<void> {
    const repoName = path.basename(repoPath.toLocaleString());
    formatedLog(repoName,`Analysing...`);
    const packageJSONPath = await findPackageJSONPath(repoPath);
    if (!packageJSONPath) {
        formatedLog(repoName,`❌ No package.json found`);
        return;
    }
    const packageJSONDependencies = await parsePackageJSON(packageJSONPath);
    if (!isWebpackProject(packageJSONDependencies)){
        formatedLog(repoName,`⚠️  Not a webpack project`);
    }

    if(!(await isESLintProject(repoPath))){
        formatedLog(repoName,`⚠️  Not a ESLint project`);
    }
}

async function cloneRepository(repo: any): Promise<string> {
    //id,name,created_at,stargazers_count
    console.log("Project " + repo.name);
    console.log("Cloning...");
    const repoPath = path.resolve(REPOSITORIES_PATH, `${repo.name}-${repo.id}`);
    const isAlreadyClone = existsSync(repoPath);
    if (isAlreadyClone) {
        console.log("Already cloned");
        return repoPath;
    }
    await fs.mkdir(repoPath, { recursive: true });
    await fs.writeFile(path.resolve(repoPath, "info.json"), JSON.stringify(repo, null, 2));
    await gitClone(repo.clone_url, path.resolve(repoPath, `${repo.name}-${repo.id}`));
    console.log("Analysing...");
    return repoPath;
}

interface Arguments {
    local: boolean;
    library: string;
    limit: number;
}
function extractArguments(): Arguments {
    const program = new Command();
    program.version("0.0.1");

    program
        .option("-l, --local", "Local mode without downloading from GitHub")
        .option("--library <string>", "Library to search for", "webpack")
        .option("--limit <number>", "Limit the number of repositories to download", '10');
    program.parse(process.argv);
    const options = program.opts();
    return {
        local: options.local,
        library: options.library,
        limit: options.limit,
    };
}

async function getFiles(dir: PathLike): Promise<string[]> {
    const subdirs = await fs.readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
      const res = path.resolve(dir.toLocaleString(), subdir);
      const stat = await fs.lstat(res);
      return stat.isDirectory() && !stat.isSymbolicLink() ? getFiles(res) : [res];
    }));
    if( files.length === 0 ){
        return [];
    }
    const result = files.reduce((a, f) => a.concat(f,[]));
    return result;
}

async function findFile(name: string, dir: PathLike): Promise<string | null> {
    const files = await getFiles(dir);
    const found = files.find((file) => file.endsWith(name));
    return found ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const args = extractArguments();
    if (!args.local){
        await fetchRepositoriesByLibrary(library, {
            per_page: args.limit,       
        });
    }
    const localRepositories = (await fs.readdir(path.resolve(REPOSITORIES_PATH), { withFileTypes: true }))
        .filter((dirent) => dirent.isDirectory());

    // await analyseRepository(path.resolve(REPOSITORIES_PATH,'97060575-raf-schd','97060575-raf-schd'))
    const tasks = new Array<Promise<any>>();
    for (const localRepository of localRepositories) {
        tasks.push(analyseRepository(path.resolve(REPOSITORIES_PATH,localRepository.name,localRepository.name)));
    }
    await Promise.all(tasks);
})();

