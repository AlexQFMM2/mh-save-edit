#ifndef P2G_PILOT_HOOK_H
#define P2G_PILOT_HOOK_H
#include "probe_log.h"
int pilot_install(void);
int pilot_prepare_data(void);
void pilot_disable(void);
void pilot_run(ProbeLog *log);
#endif
