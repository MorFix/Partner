@echo off

call apktool -f d Partner_TV_base.apk
:: xcopy /E /Y patch Partner_TV_Base
call apktool b Partner_TV_base -o mor_partner_unaligned.apk
"%JAVA_HOME%/bin/jarsigner" -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore store.keystore -keypass "123456" -storepass "123456" mor_partner_unaligned.apk alias_name
del mor_partner.apk
"%ANDROID_HOME%\build-tools\28.0.3\zipalign" 4 mor_partner_unaligned.apk mor_partner.apk
del "%~dp0\mor_partner_unaligned.apk"