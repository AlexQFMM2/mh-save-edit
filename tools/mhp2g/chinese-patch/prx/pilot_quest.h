#ifndef PILOT_QUEST_H
#define PILOT_QUEST_H
#include "pilot_core.h"

typedef struct { const char *buffer; const PilotRow *row; } PilotQuestCopy;
const PilotRow *pilot_quest_source(const PilotText *text, const uint16_t *order, uint32_t count,
    const unsigned char *base, const char *source, uint32_t field);
void pilot_quest_capture(PilotQuestCopy copies[16], const PilotRow *row, const char *buffer);
const PilotRow *pilot_quest_copy(const PilotQuestCopy copies[16], const char *buffer, uint32_t field);
#endif
