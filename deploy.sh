#!/bin/bash

npm run archive
scp fcstore.zip fc:/home/sel/www/fcstore/
ssh fc "cd /home/sel/www/fcstore && unzip -o fcstore.zip && npm install && forever restart 5"
