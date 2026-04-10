FROM node:20-slim

RUN useradd -m sandboxuser

WORKDIR /sandbox
USER sandboxuser

CMD ["node", "--version"]