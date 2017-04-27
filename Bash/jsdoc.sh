#!/bin/bash
###############################################################################################
# This script build documentation for fClient components
#
# Author  : Jakub Sliva <j.sliva@seznam.cz>
# Category: example
# Run     : bash jsdoc.sh
###############################################################################################
#
# 888888  .d8888b.  8888888b.
#     "88b d88P  Y88b 888  "Y88b
#      888 Y88b.      888    888
#      888  "Y888b.   888    888  .d88b.   .d8888b
#      888     "Y88b. 888    888 d88""88b d88P"
#      888       "888 888    888 888  888 888
#      88P Y88b  d88P 888  .d88P Y88..88P Y88b.
#      888  "Y8888P"  8888888P"   "Y88P"   "Y8888P
#    .d88P
#  .d88P"
# 888P"

# start
echo "<----------------- START (generate fClient component documentation) ----------------->"

# name of output file with result JSON
# configuration of input files is in jsdoc lib (conf.json)
outputFile="jsdoc.js"

# where is lib with JSDoc
jsdocDir="/jsdoc/"

# dir with final JSON file
outputDir="../api/"

# set root directory
cd $(dirname $0)

# complete path to file
filePath=$outputDir$outputFile

echo "Target file "$outputFile

# existing JSON file must be removed
if [ -f $filePath ]
then
  rm $filePath
  echo "Old JSON file was deleted"
fi

# run JSDoc script and output JSON save to file
echo "Generate NEW file ..."
./$jsdocDir/jsdoc.js -d console >> $filePath

# end
echo "<------------------ END (generate fClient component documentation) ------------------->"
