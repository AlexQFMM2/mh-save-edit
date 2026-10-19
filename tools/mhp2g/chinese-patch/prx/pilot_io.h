#ifndef P2G_PILOT_IO_H
#define P2G_PILOT_IO_H
#include <stddef.h>
#include <stdint.h>
int pilot_read(const char *name, unsigned char *out, size_t size, uint32_t crc);
#endif
