# Adam_Choi 컨테이너 선적 시뮬레이터 앱 포장 가이드

이 문서는 웹에서 작동하는 컨테이너 선적 시뮬레이터를 만든 뒤, 그 웹앱을 Android 앱으로 포장하고 Google Play Console 테스트 업로드용 AAB 파일을 만드는 과정을 기록한 가이드다.

한 줄로 정리하면:

```text
웹 시뮬레이터 완성 -> Capacitor로 Android 프로젝트 생성 -> Android Studio에서 signed AAB 생성 -> Play Console 업로드
```

현재 완료 상태:

- 웹앱 원본 폴더: `C:\Users\PC\Desktop\컨테이너 어플(GPT)`
- Android 프로젝트 폴더: `C:\Users\PC\Desktop\컨테이너 어플(GPT)\android`
- 앱 ID: `com.adamchoi.containerloader`
- 앱 이름: `Adam_Choi 컨테이너 선적 시뮬레이터`
- 업로드 키 파일: `C:\Users\PC\Documents\AdamChoiKeys\container_upload_key.jks`
- Play Console 업로드용 signed AAB:

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.aab
```

서명 검증 결과:

```text
jar verified.
EXIT_CODE=0
```

## 1. 앱 포장이란

처음 만든 컨테이너 시뮬레이터는 `index.html`, `app.js`, `packer.js`, `styles.css` 같은 웹 파일로 실행되는 웹앱이다.

Android 앱 포장은 이 웹앱을 Android 앱 안에 넣어서 휴대폰에서 앱처럼 실행되게 만드는 작업이다. 이번 프로젝트에서는 Capacitor를 사용했다.

역할 구분:

| 항목 | 역할 |
|---|---|
| `index.html`, `app.js`, `packer.js` 등 | 실제 시뮬레이터 코드 |
| `www` | Android 앱에 넣기 위해 복사된 웹 파일 |
| `android` | Android Studio가 여는 Android 앱 프로젝트 |
| `.apk` | 휴대폰 직접 설치 테스트용 파일 |
| `.aab` | Google Play Console 업로드용 파일 |
| `.jks` | 앱 업데이트에 계속 필요한 서명 키 |

## 2. 필요한 프로그램

필요한 도구:

- Node.js
- npm
- Android Studio
- Android SDK
- JDK 21
- Capacitor

이 프로젝트에서는 Android Studio에 포함된 JDK 21을 사용했다.

JDK 21 경로:

```text
C:\Program Files\Android\Android Studio\jbr
```

Node.js 확인:

```powershell
node -v
```

npm 확인:

```powershell
npm.cmd -v
```

PowerShell에서 `npm -v`가 막히면 npm이 설치 안 된 것이 아니라 `npm.ps1` 실행 정책 문제일 수 있다. 이 경우 계속 `npm.cmd`를 쓰면 된다.

## 3. Capacitor 설치

웹앱 프로젝트 폴더로 이동한다.

```powershell
cd "C:\Users\PC\Desktop\컨테이너 어플(GPT)"
```

Capacitor 패키지를 설치한다.

```powershell
npm.cmd install @capacitor/core @capacitor/android
npm.cmd install -D @capacitor/cli
```

설치 후 `node_modules` 폴더가 생긴다. 이 폴더는 설치된 패키지 보관소라서 직접 수정하지 않는다. GitHub나 백업에 꼭 포함할 필요도 없다. 다른 컴퓨터에서는 아래 명령으로 다시 만들 수 있다.

```powershell
npm.cmd install
```

## 4. Capacitor 설정 파일

현재 `capacitor.config.json` 설정:

```json
{
  "appId": "com.adamchoi.containerloader",
  "appName": "Adam_Choi 컨테이너 선적 시뮬레이터",
  "webDir": "www",
  "server": {
    "androidScheme": "https"
  }
}
```

주의:

- `appId`는 Google Play에 한 번 올리면 나중에 바꾸기 어렵다.
- 현재 앱 ID는 `com.adamchoi.containerloader`다.
- 첫 Play Console 업로드 전에 앱 ID가 마음에 드는지 확정해야 한다.

## 5. 웹 파일을 앱용 `www` 폴더로 복사

Capacitor는 원본 웹 파일을 직접 읽는 것이 아니라 `www` 폴더에 들어간 파일을 Android 앱에 넣는다.

웹 파일을 `www`로 복사:

```powershell
npm.cmd run prepare:web
```

정상 출력 예시:

```text
Prepared 8 web files in C:\Users\PC\Desktop\컨테이너 어플(GPT)\www
```

복사되는 주요 파일:

```text
index.html
styles.css
i18n.js
data.js
packer.js
viewer.js
app.js
사용설명서_v4.docx
```

웹앱을 수정한 뒤 Android 앱에 반영하려면 이 복사/동기화 과정을 다시 해야 한다.

## 6. Android 프로젝트 생성

최초 1회만 실행한다.

```powershell
npm.cmd run cap:add:android
```

성공하면 아래 폴더가 생긴다.

```text
android
```

이 `android` 폴더가 Android Studio에서 여는 앱 프로젝트다.

이미 `android` 폴더가 있는 상태에서 웹앱 코드만 바뀌었다면 아래 명령을 사용한다.

```powershell
npm.cmd run cap:sync:android
```

## 7. Android Studio로 열기

```powershell
npm.cmd run cap:open:android
```

정상 출력:

```text
[info] Opening Android project at: android.
```

Android Studio가 열리면 Gradle Sync가 끝날 때까지 기다린다.

## 8. Android SDK 경로 설정

SDK 경로가 없으면 빌드 중 아래 오류가 날 수 있다.

```text
SDK location not found.
```

해결 파일:

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\local.properties
```

현재 설정:

```properties
sdk.dir=C\:\\Users\\PC\\AppData\\Local\\Android\\Sdk
```

중요:

- `sdk.dir`는 반드시 소문자여야 한다.
- `SDK.dir`로 쓰면 Gradle이 못 읽을 수 있다.
- `local.properties`는 개인 PC 경로가 들어가는 파일이라 GitHub에 올리지 않는 것이 맞다.

## 9. 한글 경로 문제 해결

현재 프로젝트 경로에는 한글이 있다.

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)
```

Android 빌드 중 아래 오류가 날 수 있다.

```text
Your project path contains non-ASCII characters.
```

현재 프로젝트에서는 `android/gradle.properties`에 아래 설정을 추가해서 해결했다.

```properties
android.overridePathCheck=true
```

더 안정적인 방법은 프로젝트를 한글 없는 경로로 옮기는 것이다.

예:

```text
C:\dev\container-loader
```

## 10. JDK 21로 Gradle 확인

Android 프로젝트 폴더로 이동한다.

```powershell
cd "C:\Users\PC\Desktop\컨테이너 어플(GPT)\android"
```

Android Studio 내장 JDK 21을 사용하도록 임시 환경변수를 지정한다.

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

Gradle 확인:

```powershell
.\gradlew.bat --version
```

정상 예시:

```text
Gradle 8.14.3
Launcher JVM: 21.x
```

JDK 17을 쓰면 아래 오류가 날 수 있다.

```text
error: invalid source release: 21
```

이 경우 JDK 21로 다시 지정해야 한다.

## 11. 테스트 설치용 APK 만들기

APK는 Play Console 업로드용이 아니라 휴대폰에 직접 설치해서 테스트할 때 쓴다.

Android 프로젝트 폴더에서 실행:

```powershell
cd "C:\Users\PC\Desktop\컨테이너 어플(GPT)\android"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat assembleDebug
```

성공하면 아래 파일이 생긴다.

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\build\outputs\apk\debug\app-debug.apk
```

Android Studio에서 signed APK를 만들면 아래처럼 release APK가 생길 수 있다.

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.apk
```

하지만 Play Console 업로드용은 APK가 아니라 AAB다.

## 12. Play Console 업로드용 signed AAB 만들기

Android Studio에서 진행한다.

1. 상단 메뉴에서 `Build`
2. `Generate Signed App Bundle / APK`
3. `Android App Bundle` 선택
4. 기존 keystore 선택 또는 새 keystore 생성
5. Key alias 선택
6. `release` 선택
7. `Create`

이번에 만든 keystore:

```text
C:\Users\PC\Documents\AdamChoiKeys\container_upload_key.jks
```

Alias:

```text
container_upload
```

주의:

- keystore 비밀번호와 key 비밀번호는 절대 채팅이나 GitHub에 올리지 않는다.
- `.jks` 파일을 잃어버리면 같은 앱을 업데이트하기 어렵다.
- `.jks` 파일은 개인 백업 위치에 보관한다.

성공 후 생성된 signed AAB:

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.aab
```

Android Studio 화면에는 아래와 비슷한 메시지가 나온다.

```text
Generate Signed Bundle
App bundle(s) generated successfully
Build variant 'release'
```

## 13. AAB 서명 검증

생성된 AAB가 진짜 서명됐는지 확인한다.

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe" -verify "C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.aab"
```

정상 결과:

```text
jar verified.
```

현재 확인된 결과:

```text
jar verified.
EXIT_CODE=0
```

`self-signed` 경고가 보일 수 있다. Android 업로드 키는 자체 서명 인증서를 쓰는 것이 일반적이라 이 경고 자체는 문제로 보지 않는다.

문제가 있는 경우에는 아래처럼 나온다.

```text
jar is unsigned
```

이 메시지가 나오면 Play Console 업로드용 파일이 아니므로 Android Studio에서 signed AAB를 다시 만들어야 한다.

## 14. 다음에 웹앱 수정 후 다시 AAB 만드는 순서

시뮬레이터 코드 수정 후 다시 앱 파일을 만들 때는 아래 순서를 따르면 된다.

1. 웹앱 파일 수정
2. 웹에서 먼저 테스트
3. Android 앱에 웹 파일 동기화

```powershell
cd "C:\Users\PC\Desktop\컨테이너 어플(GPT)"
npm.cmd run cap:sync:android
```

4. Android Studio 열기

```powershell
npm.cmd run cap:open:android
```

5. Android Studio에서 signed AAB 다시 생성

```text
Build > Generate Signed App Bundle / APK > Android App Bundle > release > Create
```

6. 새 AAB 파일 확인

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.aab
```

## 15. Google Play Console 내부 테스트 업로드 순서

다음 단계에서 진행할 작업이다.

1. Google Play Console 접속
2. 앱 생성
3. 앱 이름 입력
4. 기본 앱 정보 입력
5. 내부 테스트 트랙으로 이동
6. 테스터 이메일 추가
7. 새 릴리스 생성
8. signed AAB 업로드
9. 릴리스 노트 작성
10. 검토 후 내부 테스트로 배포
11. 테스트 링크를 테스터에게 공유

업로드할 파일:

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.aab
```

공식 참고 링크:

- Google Play Console 릴리스 준비/배포: `https://support.google.com/googleplay/android-developer/answer/9859348`
- 내부 테스트 설정: `https://support.google.com/googleplay/android-developer/answer/9845334`

## 16. GitHub와 백업에서 주의할 파일

GitHub에 올려도 되는 핵심 파일:

```text
index.html
styles.css
i18n.js
data.js
packer.js
viewer.js
app.js
package.json
package-lock.json
capacitor.config.json
scripts/
android/
ANDROID_BUILD_GUIDE.md
```

GitHub에 올리지 말아야 하는 파일:

```text
node_modules/
www/
android/local.properties
android/app/build/
*.jks
*.keystore
*.aab
*.apk
```

반드시 개인 백업해야 하는 파일:

```text
C:\Users\PC\Documents\AdamChoiKeys\container_upload_key.jks
```

이 파일은 GitHub에는 올리면 안 되지만, 잃어버리면 안 된다.

## 17. 코드 보호 관련 메모

이 앱은 HTML/JS/CSS 기반 웹앱을 Android 앱으로 포장한 구조다.

핵심 로직 위치:

| 파일 | 역할 |
|---|---|
| `packer.js` | 컨테이너 적재 계산 핵심 로직 |
| `app.js` | 화면 동작, 데이터 입력, 시뮬레이션 실행 흐름 |
| `viewer.js` | 3D/시각화 표시 |
| `data.js` | 기본 데이터 |
| `i18n.js` | 화면 문구 |

앱으로 포장해도 JS 파일은 앱 내부 assets에 포함된다. 따라서 코드를 100% 숨기는 것은 불가능하다.

보호를 강화하는 방법:

- GitHub private repository 사용
- 배포 전 JS/CSS minify
- 필요 시 obfuscation 적용
- 정말 숨겨야 하는 핵심 알고리즘은 서버 API로 분리

## 18. 자주 나온 오류 정리

### npm.ps1 실행 오류

증상:

```text
npm.ps1 파일을 로드할 수 없습니다.
UnauthorizedAccess
```

해결:

```powershell
npm.cmd -v
```

이후 `npm` 대신 `npm.cmd` 사용.

### SDK location not found

증상:

```text
SDK location not found
```

해결:

```properties
sdk.dir=C\:\\Users\\PC\\AppData\\Local\\Android\\Sdk
```

### invalid source release: 21

증상:

```text
error: invalid source release: 21
```

해결:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

### 한글 경로 오류

증상:

```text
Your project path contains non-ASCII characters.
```

해결:

```properties
android.overridePathCheck=true
```

더 안정적인 대안:

```text
C:\dev\container-loader
```

### Failed to create keystore

증상:

```text
Failed to create keystore.
```

원인 후보:

- keystore를 저장할 폴더가 없음
- 파일명에 `.jks` 확장자가 없음
- 권한 문제

해결:

1. 폴더를 먼저 만든다.

```text
C:\Users\PC\Documents\AdamChoiKeys
```

2. keystore path를 아래처럼 지정한다.

```text
C:\Users\PC\Documents\AdamChoiKeys\container_upload_key.jks
```

### APK를 만든 경우

Play Console에 올릴 파일은 APK가 아니라 AAB다.

잘못 만든 파일 예:

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.apk
```

올바른 파일:

```text
C:\Users\PC\Desktop\컨테이너 어플(GPT)\android\app\release\app-release.aab
```
