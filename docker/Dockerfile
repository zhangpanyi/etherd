FROM node:8

RUN cd /root \
    && git clone https://github.com/zhangpanyi/etherd.git \
    && cd etherd \
    && npm install

COPY config /root/etherd/config

WORKDIR /root/etherd

EXPOSE 8545
