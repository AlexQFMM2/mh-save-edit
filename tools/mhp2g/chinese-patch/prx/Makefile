TARGET = mhp2g_zh_cn
OBJS = main.o
BUILD_PRX = 1
PSP_FW_VERSION = 660
CFLAGS = -O2 -G0 -Wall -Wextra -Werror
ifeq ($(HOOK_PROBE),1)
OBJS += hook_probe.o
CFLAGS += -DHOOK_PROBE
endif
ifeq ($(EQUIPMENT_PROBE),1)
OBJS = equipment_main.o equipment_hook.o probe_core.o probe_log.o
endif
CXXFLAGS = $(CFLAGS) -fno-exceptions -fno-rtti
ASFLAGS = $(CFLAGS)
LIBS =
ifeq ($(PILOT),1)
OBJS = equipment_main.o pilot_hook.o pilot_font.o pilot_io.o pilot_core.o probe_core.o probe_log.o
CFLAGS += -DPILOT
LIBS += -lpspfont
endif
ifeq ($(BATCH),1)
CFLAGS += -DBATCH
OBJS += pilot_quest.o
ifneq ($(BATCH_ROWS),)
CFLAGS += -DPILOT_MAX_ROWS=$(BATCH_ROWS)
endif
endif
PSPSDK := $(shell psp-config --pspsdk-path)
include $(PSPSDK)/lib/build.mak
