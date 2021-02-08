#!/bin/bash

set -e

function checkout {
    local REF=
    case $GITHUB_EVENT_NAME in
        pull_request)
            REF=$GITHUB_REF
            ;;
        push)
            REF=$GITHUB_REF
            ;;
        tag)
            REF=$GITHUB_REF
            ;;
        *)
            echo "Unable to handle events of type $GITHUB_EVENT_NAME; aborting"
            exit 1
    esac

    echo "Cloning repository"
    git clone https://github.com/"${GITHUB_REPOSITORY}" .
    echo "Checking out ref ${REF}"
    git checkout $REF
}

echo "Environment:"
env

checkout

DIFF=

if [[ "$GITHUB_EVENT_NAME" == "pull_request" ]];then
    DIFF=$(git diff --name-only $GITHUB_BASE_REF...HEAD)
    echo ${DIFF} > .laminas-ci-diff
fi

REQUIRE_CHECKS=true
if [[ "$DIFF" != "" ]];then
    echo "Found changes in the following files:"
    cat .laminas-ci-diff
    REQUIRE_CHECKS=false
fi

echo "Requiring code checks: ${REQUIRE_CHECKS}"

/action/index.js ${REQUIRE_CHECKS}
