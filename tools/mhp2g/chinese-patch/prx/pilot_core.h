#ifndef P2G_PILOT_CORE_H
#define P2G_PILOT_CORE_H
#include <stddef.h>
#include <stdint.h>
#ifdef BATCH
#ifndef PILOT_MAX_ROWS
#define PILOT_MAX_ROWS 32768
#endif
_Static_assert(PILOT_MAX_ROWS > 0 && PILOT_MAX_ROWS <= 32768, "Invalid batch row capacity");
#define PILOT_PACKET_BYTES (4u*1024u*1024u)
#else
#define PILOT_MAX_ROWS 128
#define PILOT_PACKET_BYTES (128u*1024u)
#endif
typedef struct {
    uint32_t member, table, index, offset, original_size, translated_size, flag, resource_size;
    const char *original, *translated;
} PilotRow;
typedef struct { PilotRow rows[PILOT_MAX_ROWS]; uint32_t count; } PilotText;
uint32_t pilot_word(const unsigned char *p);
int pilot_parse(PilotText *out, const unsigned char *bytes, size_t size);
int pilot_source(const PilotRow *row, const unsigned char *resource, size_t size, const char *result);
const PilotRow *pilot_find(const PilotText *text, uint32_t member, uint32_t table, uint32_t index);
int pilot_utf8(const unsigned char *p, size_t n);

#define PILOT_POOL_BYTES 32768
#define PILOT_POOL_SLOTS 64
typedef struct { uint32_t offset, size; } PilotAllocation;
typedef struct {
    _Alignas(16) unsigned char bytes[PILOT_POOL_BYTES];
    PilotAllocation slots[PILOT_POOL_SLOTS];
    uint32_t used, peak, failures;
} PilotPool;
void *pilot_alloc(PilotPool *pool, uint32_t size);
int pilot_free(PilotPool *pool, void *pointer);
#endif
