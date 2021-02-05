#!/bin/bash

function checkout {
    local REF=
    case $GITHUB_EVENT_NAME in
        pull_request)
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

checkout
/action/index.js
