/* eslint-disable no-shadow */
import { Octokit } from "@octokit/rest";
import * as path from "path";
import gitClone from "git-clone/promise";
import fined from "fined";
import fs from "fs";
import { Command, program } from "commander";

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

function findPackageJSONPath(repoPath: fs.PathLike): fs.PathLike | null {
    const packageJSONPath = path.normalize(repoPath + "/package.json");
    if (fs.existsSync(packageJSONPath)) {
        return packageJSONPath;
    }
    const packageJSONPaths = fined({
        path: repoPath.toLocaleString(),
        name: "package.json",
    });
    return packageJSONPaths?.path ?? null;
}

function parsePackageJSON(packagePath: fs.PathLike): Record<string, string> {
    const packageJSON = require("" + packagePath);
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

function analyseRepository(repoPath: fs.PathLike): void {
    const packageJSONPath = findPackageJSONPath(repoPath);
    if (!packageJSONPath) {
        console.log(`❌ No package.json found`);
        return;
    }
    const packageJSONDependencies = parsePackageJSON(packageJSONPath);
    if (!isWebpackProject(packageJSONDependencies)){
        console.log("⚠️  Not a webpack project");
    }
}

async function cloneRepository(repo: any): Promise<string> {
    fs.mkdirSync(REPOSITORIES_PATH, { recursive: true });
    //id,name,created_at,stargazers_count
    console.log("Project " + repo.name);
    console.log("Cloning...");
    const repoPath = path.resolve(REPOSITORIES_PATH, repo.name);
    const isAlreadyClone = fs.existsSync(repoPath);
    if (isAlreadyClone) {
        console.log("Already cloned");
        return repoPath;
    }
    await gitClone(repo.clone_url, repoPath);
    console.log("Analysing...");
    console.log("As .eslintrc => " + (fined({ path: repoPath, name: ".eslintrc" }) ? "yes" : "no"));

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
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const args = extractArguments();
    if (!args.local){
        await fetchRepositoriesByLibrary(library, {
            per_page: args.limit,       
        });
    }
    const localRepositories = (await fs.promises.readdir(path.resolve(REPOSITORIES_PATH), { withFileTypes: true }))
        .filter((dirent) => dirent.isDirectory());

    for (const localRepository of localRepositories) {
        console.log(`Analysing ${localRepository.name}`);
        analyseRepository(path.resolve(REPOSITORIES_PATH,localRepository.name));
    }
})();
