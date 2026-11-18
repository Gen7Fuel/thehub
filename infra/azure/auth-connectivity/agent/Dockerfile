# Microsoft HCM 1.3.0 Linux x64, verified 2026-11-18. Fail closed if the
# unversioned vendor URL changes; review a new digest before updating.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libicu72 libssl3 libgssapi-krb5-2 libstdc++6 zlib1g bash \
    && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:9a3257be23453443e4f848eef342cced1547cee1c9f4193afff22d2ced80ee9c \
    https://download.microsoft.com/download/HybridConnectionManager-Linux.tar.gz /tmp/hcm.tar.gz
RUN mkdir -p /opt/hcm /usr/share/HybridConnectionManager /data \
    && tar -xzf /tmp/hcm.tar.gz -C /opt/hcm --strip-components=1 \
    && rm /tmp/hcm.tar.gz \
    && chmod 755 /opt/hcm/Service/HybridConnectionManagerService /opt/hcm/CLI/hcm \
    && groupadd --gid 10001 hcm \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /data hcm \
    && chown 10001:10001 /data /usr/share/HybridConnectionManager
ENV ASPNETCORE_ENVIRONMENT=Production DOTNET_PRINT_TELEMETRY_MESSAGE=false \
    DOTNET_EnableDiagnostics=0 HOME=/data
WORKDIR /opt/hcm/Service
USER 10001:10001
STOPSIGNAL SIGINT
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/5001"]
ENTRYPOINT ["/opt/hcm/Service/HybridConnectionManagerService"]
