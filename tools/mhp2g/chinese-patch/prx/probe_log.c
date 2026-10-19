#include "probe_log.h"
#include <stdio.h>

int probe_event(ProbeLog *log, const char *event, const char *fields) {
    char line[512];
    if (log->failed || log->capped) return 0;
    int cap = log->bytes > PROBE_LOG_LIMIT - sizeof(line) * 2;
    int n = snprintf(line, sizeof(line),
        "P2GPROBE/1 seq=%lu build=%s run=%s mode=%lu target=%lu:%lu event=%s%s%s\n",
        (unsigned long)++log->sequence, log->build, log->run, (unsigned long)log->mode,
        (unsigned long)log->table, (unsigned long)log->index,
        cap ? "log_limit" : event, !cap && fields && *fields ? " " : "", !cap && fields ? fields : "");
    if (n <= 0 || (size_t)n >= sizeof(line) || !log->write(log->context, line, (size_t)n)) {
        log->failed = 1; return 0;
    }
    log->bytes += (size_t)n;
    if (cap) log->capped = 1;
    return !cap;
}
