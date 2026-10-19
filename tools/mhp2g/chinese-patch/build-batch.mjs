#!/usr/bin/env node
import assert from 'node:assert/strict'
import {buildPilot} from './build-pilot.mjs'
const [toolchain,nativeDirectory,evidenceDirectory,fontFile,indexFile,draftFile,resourcesFile,inspectionFile,previousStageDirectory,output,questsFile,listsFile]=process.argv.slice(2)
assert(output,'Usage: build-batch.mjs <toolchain> <native-dir> <pilot-evidence-dir> <font> <index> <translations> <resources> <consumer-evidence> <accepted-pilot-stage> <new-output> [<quest-envelopes> <quest-lists>]')
const result=buildPilot({toolchain,nativeDirectory,evidenceDirectory,fontFile,output,
  batch:{indexFile,draftFile,resourcesFile,inspectionFile,previousStageDirectory,questsFile,listsFile}})
console.log(JSON.stringify({delivery:result.delivery,builds:Object.fromEntries(Object.entries(result.builds).map(([k,v])=>[k,v.probe]))},null,2))
