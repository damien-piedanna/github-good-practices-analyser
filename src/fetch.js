const { Octokit } = require("@octokit/rest");
const path = require('path');
const gitClone = require('git-clone');
const fined = require('fined');


const library = process.argv[2] ?? 'webpack';
const octokit = new Octokit();


function fetchRepositoriesByLibrary(library) {
    //https://github.com/search?q=webpack+in%3Apackage.json+language%3Ajavascript+archived%3Afalse+is%3Apublic&type=Repositories
    //Warning: package.json may not be located at the root
    octokit.rest.search.repos({
        q: library + '+in:package.json+language:javascript+archived:false+is:public',
        sort: 'updated',
        order: 'desc',
        per_page: 1,
        page: 2,
    }).then(async ({data}) => {
        for (const repo of data.items) {
            //id,name,created_at,stargazers_count
            console.log("Project " + repo.name);
            console.log("Cloning...");
            const repoPath = path.normalize(path.resolve(__dirname) + '/../repositories/' + repo.id);
            await gitClone(repo.clone_url, repoPath);
            console.log("Analysing...");
            console.log("As .eslintrc => " + (fined({path: repoPath, name: '.eslintrc'}) ? 'yes' : 'no'));
            //TODO: Analyse good practice according to the gdoc
            //TODO: Store result in excel
        }
    });
}

fetchRepositoriesByLibrary(library);