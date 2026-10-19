#include "pilot_quest.h"
#include <string.h>

static int quest_ram(const void *pointer, uint32_t size) {
    uintptr_t at=(uintptr_t)pointer;
    return at>=0x08800000u && at<=0x0a000000u && size<=0x0a000000u-at;
}
const PilotRow *pilot_quest_source(const PilotText *text, const uint16_t *order, uint32_t count,
    const unsigned char *base, const char *source, uint32_t field) {
    if (!source || (field>=6 && field!=UINT32_MAX)) return NULL;
    uint32_t lo=0,offset=0;
    if (base) {
        if ((uintptr_t)source<(uintptr_t)base || (uintptr_t)source-(uintptr_t)base>UINT32_MAX) return NULL;
        offset=(uint32_t)((uintptr_t)source-(uintptr_t)base);
        uint32_t hi=count;
        while (lo<hi) {
            uint32_t mid=lo+(hi-lo)/2;
            if (text->rows[order[mid]].offset<offset) lo=mid+1; else hi=mid;
        }
    }
    for (;lo<count;++lo) {
        const PilotRow *row=&text->rows[order[lo]];
        if (base && row->offset!=offset) break;
        if (field<6 && row->index!=field) continue;
        /* The copy call exposes the original source pointer. Deriving a
           candidate base is safe only after checking all accessed RAM and
           the complete native record/slot/original-string identity. */
        const unsigned char *candidate=base;
        if (!candidate) {
            if ((uintptr_t)source<row->offset) continue;
            candidate=(const unsigned char *)((uintptr_t)source-row->offset);
        }
        if (!quest_ram(candidate,row->resource_size) ||
            !quest_ram(source,row->original_size+1)) continue;
        if (pilot_source(row,candidate,row->resource_size,source)) return row;
    }
    return NULL;
}
void pilot_quest_capture(PilotQuestCopy copies[16], const PilotRow *row, const char *buffer) {
    unsigned int slot=16;
    for (unsigned int i=0;i<16;++i) {
        if (copies[i].buffer==buffer) { slot=i; break; }
        if (!copies[i].buffer && slot==16) slot=i;
    }
    if (slot==16) { memmove(copies,copies+1,15*sizeof(*copies));slot=15; }
    copies[slot]=(PilotQuestCopy){buffer,row};
}
const PilotRow *pilot_quest_copy(const PilotQuestCopy copies[16], const char *buffer, uint32_t field) {
    if (field>=6) return NULL;
    for (unsigned int i=0;i<16;++i) {
        const PilotRow *row=copies[i].row;
        if (copies[i].buffer==buffer && row && row->index==field &&
            quest_ram(buffer,row->original_size+1) &&
            !memcmp(buffer,row->original,row->original_size+1)) return row;
    }
    return NULL;
}
