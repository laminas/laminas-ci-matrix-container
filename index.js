#!/usr/bin/env node
const core = require('@actions/core');
const semver = require('semver')
const fs = require('fs')
const process = require('process');

const args = process.argv.slice(2)

let require_checks_arg  = '';
let require_code_checks = true;
let require_doc_linting = true;

if (args.length) {
    require_checks_arg = args.shift();
    if (require_checks_arg === 'false') {
        require_code_checks = false;
        require_doc_linting = false;
    }
}

if (require_checks_arg === 'false') {
    let diff = [];
    if (fs.existsSync('.laminas-ci-diff')) {
        diff = fs.readFileSync('.laminas-ci-diff').toString().split(/\r?\n/);
    }

    diff.forEach(function (filename) {
        /** @var String filename */
        if (filename.match(/\.php$/)) {
            core.info('- Enabling code checks due to presence of PHP files in diff');
            require_code_checks = true;
        }

        if (filename.match(/(phpunit|phpcs|psalm)\.xml(\.dist)?$/)) {
            core.info('- Enabling code checks due to presence of check config files in diff');
            require_code_checks = true;
        }

        if (filename.match(/composer\.(json|lock)$/)) {
            core.info('- Enabling code checks due to presence of composer files in diff');
            require_code_checks = true;
        }

        if (filename.match(/(^|[/\\])(\.github|src|lib|tests?|config|bin)[/\\]/)) {
            core.info('- Enabling code checks due to file existing in source directory');
            require_code_checks = true;
        }

        if (filename.match(/(^mkdocs.yml|docs?\/book\/.*\.md$)/)) {
            core.info('- Enabling markdown linting due to documentation existing in diff');
            require_doc_linting = true;
        }
    });
}

let config = {};
if (fs.existsSync('.laminas-ci.json')) {
    try {
        config = JSON.parse(fs.readFileSync('.laminas-ci.json'));
    } catch (error) {
        core.setFailed('Failed to parse .laminas-ci.json: ' + error.message);
    }
}

let composerJson = {};
try {
    composerJson = JSON.parse(fs.readFileSync('composer.json'));
} catch (error) {
    core.setFailed('Failed to parse composer.json: ' + error.message);
}

let stablePHP = config["stablePhp"] !== undefined ? config["stablePhp"] : "7.4";
core.info(`Using stable PHP version: ${stablePHP}`);

let phpIni = ["memory_limit=-1"];
if (config.ini !== undefined && Array.isArray(config.ini)) {
    phpIni = phpIni.concat(config.ini);
}
core.info(`Providing php.ini settings: ${JSON.stringify(phpIni)}`);

let extensions = [];
if (config.extensions !== undefined && Array.isArray(config.extensions)) {
    extensions = extensions.concat(config.extensions);
}
core.info(`Using php extensions: ${JSON.stringify(extensions)}`);

let versions = [];
[
    '5.6',
    '7.0',
    '7.1',
    '7.2',
    '7.3',
    '7.4',
    '8.0',
].forEach(function (version) {
    if (semver.satisfies(version + '.0', composerJson['require']['php'])) {
        versions.push(version);
    }
});
core.info(`Versions found: ${JSON.stringify(versions)}`);

let dependencies = ['lowest', 'latest'];
if (fs.existsSync('composer.lock')) {
    dependencies.push('locked');
}
core.info(`Dependency sets found: ${JSON.stringify(dependencies)}`);

let phpunit = false;
if (! require_code_checks) {
    core.info('No code checks required; skipping PHPUnit checks');
} else if (fs.existsSync('./phpunit.xml.dist') || fs.existsSync('./phpunit.xml')) {
    core.info('Found phpunit configuration');
    phpunit = true;
} else {
    core.info('NO phpunit configuration found');
}

let checks = [];

const fileTest = function (filename) {
    return function () {
        if (fs.existsSync(filename)) {
            return true;
        }
        return false;
    };
};

if (config.checks !== undefined && Array.isArray(config.checks)) {
    core.info('Using checks found in configuration');
    checks = config;
} else {
    core.info('Discovering checks based on QA files in package');
    [
        {
            command: "./vendor/bin/phpcs -q --report=checkstyle | cs2pr",
            runCheck: require_code_checks,
            test: [
                fileTest('phpcs.xml.dist'),
                fileTest('phpcs.xml'),
            ]
        },
        {
            command: "./vendor/bin/psalm --shepherd --stats --output-format=github",
            runCheck: require_code_checks,
            test: [
                fileTest('psalm.xml.dist'),
                fileTest('psalm.xml'),
            ]
        },
        {
            command: "./vendor/bin/phpbench run --revs=2 --iterations=2 --report=aggregate",
            runCheck: require_code_checks,
            test: [
                fileTest('phpbench.json'),
            ]
        },
        {
            command: "yamllint mkdocs.yml",
            runCheck: require_doc_linting,
            test: [
                fileTest('mkdocs.yml'),
            ]
        },
        {
            command: "markdownlint doc/book/**/*.md",
            runCheck: require_doc_linting,
            test: [
                fileTest('doc/book/'),
            ]
        },
        {
            command: "markdownlint docs/book/**/*.md",
            runCheck: require_doc_linting,
            test: [
                fileTest('docs/book/'),
            ]
        },
    ].forEach(function (check) {
        // Skip code checks if they are not required
        if (! check.runCheck) {
            return;
        }

        check.test.forEach(function (test) {
            if (checks.indexOf(check.command) !== -1) {
                return;
            }

            if (test()) {
                checks.push(check.command);
            }
        });
    });
}
core.info(`Checks found: ${JSON.stringify(checks)}`);

let jobs = [];
if (phpunit) {
    versions.forEach(function (version) {
        dependencies.forEach(function (deps) {
            let job = {
                command: './vendor/bin/phpunit',
                php: version,
                extensions: extensions,
                ini: phpIni,
                dependencies: deps,
            };
            jobs.push({
                name: 'PHPUnit on PHP ' + version + ' with ' + deps + ' dependencies',
                job: JSON.stringify(job),
                operatingSystem: 'ubuntu-latest',
                action: 'laminas/laminas-continuous-integration-action@v0',
            });
        });
    });
}
if (checks.length) {
    checks.forEach(function (command) {
        let job = {
            command: command,
            php: stablePHP,
            extensions: extensions,
            ini: phpIni,
            dependencies: 'locked',
        };
        jobs.push({
            name: command + ' on PHP ' + stablePHP,
            job: JSON.stringify(job),
            operatingSystem: 'ubuntu-latest',
            action: 'laminas/laminas-continuous-integration-action@v0',
        });
    });
}

if (! jobs.length) {
    let job = {
        command: 'echo "No checks discovered!"',
        php: stablePHP,
        extensions: [],
        ini: [],
        dependencies: 'locked',
    };

    jobs.push({
        name: 'No checks',
        job: JSON.stringify(job),
        operatingSystem: 'ubuntu-latest',
        action: 'laminas/laminas-continuous-integration-action@v0',
    });
}

let matrix = {include: jobs};

if (config.exclude !== undefined && Array.isArray(config.exclude)) {
    core.info('Adding exclusions from configuration');
    matrix.exclude = config.exclude;
}

core.info(`Matrix: ${JSON.stringify(matrix)}`);
core.setOutput('matrix', JSON.stringify(matrix));
