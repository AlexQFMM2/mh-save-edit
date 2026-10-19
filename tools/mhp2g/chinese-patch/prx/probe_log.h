#ifndef P2G_PROBE_LOG_H
#define P2G_PROBE_LOG_H
#include <stddef.h>
#include <stdint.h>
#define PROBE_LOG_LIMIT (256u * 1024u)
typedef int (*ProbeWrite)(void *, const char *, size_t);
typedef struct {
    ProbeWrite write;
    void *context;
    const char *build, *run;
    uint32_t mode, table, index, sequence;
    size_t bytes;
    int failed, capped;
} ProbeLog;
int probe_event(ProbeLog *log, const char *event, const char *fields);
#endif
