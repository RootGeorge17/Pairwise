FROM node:20-slim

RUN groupadd --gid 10001 sandboxgroup \
    && useradd --uid 10001 --gid 10001 --create-home sandboxuser

WORKDIR /sandbox
USER sandboxuser

CMD ["node", "--version"]