#!/usr/bin/env python3
"""Execute only three reviewed private ARM windows in isolated Unicorn memory.

Dependency: uv run --no-project --with unicorn==2.1.4 --python /usr/bin/python3
No full executable, real save, host game process, or game filesystem is loaded.
Outputs are private research. This checks code/model equivalence for chosen
inputs and FPSCR, not naturally reachable initial states or all game paths.
"""
import argparse
import hashlib
import json
import pathlib
import struct

from extract_mh4g_charm_native import RAW_SHA256, EXPANDED_SHA256, require

RANGES = [(0x2e6440, 0x2e6a48), (0x2a5b40, 0x2a5b88), (0x2ffdc8, 0x2fff08)]
RECORD, CONTEXT, STACK, STACK_END, STOP = 0x20000000, 0x20001000, 0x20002000, 0x20012000, 0x30000000


class AppraisalExecutor:
    def __init__(self, native, windows):
        import unicorn
        from unicorn import arm_const as arm
        require(unicorn.__version__ == '2.1.4', 'Use pinned Unicorn 2.1.4')
        self.unicorn, self.arm = unicorn, arm
        require(native['format'] == 'mh4g-charm-native-v1', 'Unsupported native input')
        require(windows['format'] == 'mh4g-charm-instruction-windows-v1', 'Unsupported instruction input')
        for value in [native, windows]:
            require(value['source']['codeSha256'] == RAW_SHA256 and value['source']['expandedSha256'] == EXPANDED_SHA256, 'Unreviewed executable')
        require([(w['address'], w['end']) for w in windows['windows']] == RANGES, 'Unreviewed code window')
        require(len(native['groups']) == 6, 'Expected six groups')
        uc = self.uc = unicorn.Uc(unicorn.UC_ARCH_ARM, unicorn.UC_MODE_ARM)
        uc.ctl_set_cpu_model(arm.UC_CPU_ARM_1176)
        pages = set()
        def put(address, data):
            for page in range(address & ~4095, (address + len(data) + 4095) & ~4095, 4096):
                if page not in pages:
                    uc.mem_map(page, 4096)
                    pages.add(page)
            uc.mem_write(address, bytes(data))
        for window in windows['windows']:
            require(len(window['words']) == (window['end'] - window['address']) // 4, 'Window word count mismatch')
            data = struct.pack('<' + 'I' * len(window['words']), *window['words'])
            require(len(data) == window['end'] - window['address'], 'Window length mismatch')
            require(hashlib.sha256(data).hexdigest() == window['sha256'], 'Window digest mismatch')
            put(window['address'], data)
        pointers = []
        for index, group in enumerate(native['groups']):
            require(group['groupIndex'] == index, 'Group ordering mismatch')
            for position in ['A', 'B']:
                pool = group['pools'][position]
                data = b''.join(struct.pack('<BBbb', skill, 1, low, high) for skill, low, high in pool['rows'])
                require(hashlib.sha256(data).hexdigest() == pool['sha256'], 'Pool digest mismatch')
                require(0xf33000 <= pool['address'] <= pool['address'] + len(data) < 0xf34000, 'Pool address outside reviewed page')
                if data:
                    put(pool['address'], data)
                pointers.append(pool['address'])
            require(group['slotAddress'] == 0xf11088 + index * 84, 'Slot address mismatch')
            data = bytes(value for row in group['slotWeights'] for value in row)
            require(len(data) == 84 and hashlib.sha256(data).hexdigest() == group['slotSha256'], 'Slot digest mismatch')
            put(group['slotAddress'], data)
        put(0xf11058, struct.pack('<12I', *pointers))
        put(0xf886a0, struct.pack('<I', CONTEXT))
        for page in pages:
            executable = any((start & ~4095) <= page <= ((end - 1) & ~4095) for start, end in RANGES)
            uc.mem_protect(page, 4096, unicorn.UC_PROT_READ | (unicorn.UC_PROT_EXEC if executable else 0))
        uc.mem_map(RECORD, 0x20000, unicorn.UC_PROT_READ | unicorn.UC_PROT_WRITE)
        uc.reg_write(arm.UC_ARM_REG_C1_C0_2, 0x00f00000)
        uc.reg_write(arm.UC_ARM_REG_FPEXC, 0x40000000)
        uc.hook_add(unicorn.UC_HOOK_CODE, self.on_instruction)
        uc.hook_add(unicorn.UC_HOOK_MEM_WRITE, self.on_write)
        self.capture = {}

    def on_instruction(self, uc, address, size, _):
        require(size == 4 and any(start <= address < end for start, end in RANGES), f'Execution escaped reviewed windows at {address:#x}')
        if address == 0x2e68ac:
            self.capture['fulfillmentBits'] = uc.reg_read(self.arm.UC_ARM_REG_S16)
        if address == 0x2e68b0:
            self.capture['row'] = uc.reg_read(self.arm.UC_ARM_REG_S0)

    def on_write(self, uc, access, address, size, value, _):
        permitted = [(RECORD, RECORD + 28), (CONTEXT + 32, CONTEXT + 36), (STACK, STACK_END)]
        require(any(low <= address and address + size <= high for low, high in permitted), f'Unexpected guest write {address:#x}')

    def run(self, group, first, second):
        require(0 <= group < 6 and 0 <= first <= 65535 and 0 <= second <= 65535, 'Invalid execution input')
        uc, arm = self.uc, self.arm
        self.capture = {}
        uc.mem_write(RECORD, bytes(28))
        uc.mem_write(CONTEXT + 32, struct.pack('<HH', first, second))
        uc.mem_write(STACK, bytes(STACK_END - STACK))
        for register in range(13):
            uc.reg_write(getattr(arm, 'UC_ARM_REG_R' + str(register)), 0)
        for register in range(32):
            uc.reg_write(getattr(arm, 'UC_ARM_REG_S' + str(register)), 0)
        uc.reg_write(arm.UC_ARM_REG_CPSR, 0x10)
        uc.reg_write(arm.UC_ARM_REG_FPSCR, 0x03000000)
        uc.reg_write(arm.UC_ARM_REG_R1, RECORD)
        uc.reg_write(arm.UC_ARM_REG_R2, group)
        uc.reg_write(arm.UC_ARM_REG_SP, STACK_END)
        uc.reg_write(arm.UC_ARM_REG_LR, STOP)
        uc.emu_start(RANGES[0][0], STOP, count=5000)
        require(uc.reg_read(arm.UC_ARM_REG_PC) == STOP, 'Instruction budget exhausted')
        require('row' in self.capture and 'fulfillmentBits' in self.capture, 'Missing execution checkpoints')
        record = bytes(uc.mem_read(RECORD, 28))
        final = list(struct.unpack('<HH', uc.mem_read(CONTEXT + 32, 4)))
        return {'groupIndex': group, 'initialState': [first, second], 'finalState': final,
                'classId': struct.unpack_from('<H', record, 2)[0], 'slots': record[1],
                'skill1Id': struct.unpack_from('<H', record, 12)[0], 'skill1Points': struct.unpack_from('<h', record, 14)[0],
                'skill2Id': struct.unpack_from('<H', record, 16)[0], 'skill2Points': struct.unpack_from('<h', record, 18)[0],
                **self.capture}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native', required=True)
    parser.add_argument('--windows', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--cases-per-group', type=int, default=1024)
    args = parser.parse_args()
    require(1 <= args.cases_per_group <= 4096, 'Bounded case count required')
    native_path, windows_path, output = map(pathlib.Path, [args.native, args.windows, args.output])
    require(not output.exists(), 'Refusing to overwrite existing execution evidence')
    native_raw, windows_raw = native_path.read_bytes(), windows_path.read_bytes()
    executor = AppraisalExecutor(json.loads(native_raw), json.loads(windows_raw))
    cases = [executor.run(group, seed, (seed * 977 + 13) & 65535) for group in range(6) for seed in range(args.cases_per_group)]
    result = {'format': 'mh4g-charm-execution-v1', 'engine': 'unicorn-2.1.4-arm1176', 'fpscr': 0x03000000,
              'nativeSha256': hashlib.sha256(native_raw).hexdigest(), 'windowsSha256': hashlib.sha256(windows_raw).hexdigest(),
              'limitations': ['chosen-initial-states-not-game-samples', 'other-acquisition-paths', 'runtime-fpscr-state'], 'cases': cases}
    with output.open('x', encoding='utf-8') as file:
        json.dump(result, file, separators=(',', ':'))
        file.write('\n')
    print(json.dumps({'cases': len(cases), 'engine': result['engine'], 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
