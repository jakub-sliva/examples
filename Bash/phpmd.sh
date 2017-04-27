#!/bin/bash
###############################################################################################
# This scripts will find all phpmd violations with the author of last change of the file. 
# PHPMD will find warnings and errors for listed moduls and errors only for the rest of the files. 
# Only files updated after the given date will be checked again.
#
# Author  : Jakub Sliva <j.sliva@seznam.cz>
# Category: example
# Run     : bash phpmd.sh
###############################################################################################

#list of moduls which has to be clear - no errors, no warnings
moduls=$1

#files
changeFiles=changeFiles.txt
fileList=pmd-files.txt
reportFile=pmd-summary.txt
#clean
rm -f $changeFiles $fileList $reportFile

revisionInfo=`svn info | grep Revision`
lastRevision=`echo $revisionInfo | awk -F ":" '{print $2}'`

#find the files changed after the given date
svn diff portal --summarize -r 99999:`echo $lastRevision` > $changeFiles

#extract only filenames from phpmd xml output
awk '/file name/ {print $2}' FS='"' pmd.xml > $fileList

#remove absolute path to current dir from files (there is full path from root not relative path)
currentDir=`pwd`/
sed -i 's#'$currentDir'##' $fileList

#count of found violations
findings=0

#run phpmd for files which was updated after the given date
while read line
  do
    # is the file in the list of changed files?    
    changed=`grep -c "$line" $changeFiles`
    if [[ $changed == 1 ]]
      then
      #modul where is the file
      modul=`echo $line | awk -F "/" '{print $2}'`
      #found out if modul is in the list of moduls which has to be clear
      strict=`echo $moduls | grep -c $modul`
      if [[ $strict == 1 ]]
      then
        #find errors and warnings in each file which was changed
        violations=`phpmd $line text phpmd-errors.xml,phpmd-warnings.xml`
      else
        #find errors in each file which was changed
        violations=`phpmd $line text phpmd-errors.xml`
      fi
      
      #count lines of phpmd output
      linesCount=`echo "$violations" | wc -l`
      #if cout of lines is greater than 1 then print result into the report file with author of last change
      #if there is no violation then count of lines=1 so we need the count which is greater
      if [[ $linesCount -gt 1 ]]
        then
        findings=$((findings+1))
        author=`svn log -l 1 $line | awk 'NR==2 {print $3}'`
        #print all violations in the file and then add author of the last change of the file
        echo $violations >> "$reportFile"
        echo ==$author >> $reportFile
        echo "" >> $reportFile
      fi
    fi
  done < $fileList

#each violation to one line
if [ -f $reportFile ]
then
  sed -i 's#. /#.\n/#g' $reportFile
fi


#inform by email if there are some findings
if [ $findings -gt 0 ]; then
  echo there are $findings findings

  SUBJECT="PHPMD report"
  EMAILMESSAGE="$reportFile"

  EMAIL="j.sliva@seznam.cz"
  /usr/bin/mail -s "$SUBJECT" "$EMAIL" < $EMAILMESSAGE
fi