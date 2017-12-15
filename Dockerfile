FROM node:6.10

WORKDIR /app
RUN yarn install

RUN yarn global add serverless

ENTRYPOINT '/bin/bash'
