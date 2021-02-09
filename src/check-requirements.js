import core from '@actions/core';
import fs from 'fs';

export class Requirements {
    code_checks = true;
    doc_linting = true;

    constructor(code_checks, doc_linting) {
        this.code_checks = code_checks;
        this.doc_linting = doc_linting;
    }
}

export default function (args) {
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

    return new Requirements(require_code_checks, require_doc_linting);
};
