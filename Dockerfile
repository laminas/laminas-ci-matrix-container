FROM node:buster

LABEL "repository"="http://github.com/laminas/laminas-ci-matrix-container"
LABEL "homepage"="http://github.com/laminas/laminas-ci-matrix-container"
LABEL "maintainer"="https://github.com/laminas/technical-steering-committee/"

RUN apt-get update \
    && apt-get full-upgrade -y \
    && apt-get install -y git \
    && apt-get clean

RUN mkdir /action
ADD index.js /action/index.js
ADD package.json /action/package.json
ADD package-lock.json /action/package-lock.json
RUN (cd /action ; npm install)

ADD entrypoint.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
