# docker-compose

**1. 修改配置**

配置文件位于 `docker/config` 目录下，构建镜像前请根据需求自行修改。如果服务运行期间需要更新配置文件，使用命令 `docker cp config etherd:/root/etherd/config`，将配置文件拷贝到容器。然后执行：
```
docker-compose stop
docker-compose up -d
```
重启容器即可。

**2. 快速部署**
```
docker-compose build
docker volume create etherd-data-volume
docker-compose up -d
```