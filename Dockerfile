FROM node:8

COPY app /etherd/app
COPY test /etherd/test
COPY contract /etherd/contract
COPY index.js /etherd/index.js
COPY package.json /etherd/package.json
COPY package-lock.json /etherd/package-lock.json

RUN cd /etherd && npm install

WORKDIR /etherd

EXPOSE 8545
