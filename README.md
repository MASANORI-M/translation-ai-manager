Note: The English translation is provided after the Japanese text. 

# Translation AI Manager

## 概要

Upwork等で受注した英語スクリプトから日本語への翻訳作業を支援する、個人用Webアプリケーションです。YouTube等の英語スクリプトを、自然な話し言葉の日本語へローカライズする作業を想定しています。

OpenAI API（ChatGPT / OpenAIモデル）で翻訳候補を生成し、ユーザーが確認・採用・修正して最終翻訳を作成します。「AIによる翻訳候補生成 + 人間による確認・修正」を基本とした翻訳支援環境です。

## システム構成

バージョンは依存定義とDocker設定に基づく主要バージョンです。依存パッケージの正確なバージョンは `frontend/package-lock.json` と `backend/composer.lock` で固定しています。

| 分類 | 使用技術 |
| --- | --- |
| Frontend | React 19、TypeScript 6、Vite 8、Tailwind CSS 4、React Router 7 |
| Backend | Laravel 13、PHP 8.3、Laravel Sanctum 4、Laravel HTTP Client、BCMath |
| Database | MySQL 8.4 |
| AI | OpenAI Responses API（Backendから呼び出し） |
| 開発環境 | Docker、Docker Compose v2、Node.js 24、Composer 2、phpMyAdmin 5.2 |
| テスト・品質管理 | Vitest、Testing Library、jsdom、ESLint、PHPUnit、Mockery、Laravel Pint |

アプリで選択可能にしているAIモデルは `gpt-6-luna`（初期選択）、`gpt-6.1-sol`、`gpt-6-sol` です。モデルの有効・無効、生成設定、料金定義は `backend/config/ai.php` で管理しています。

## Architecture

```text
Browser
  ↓
React Frontend / Vite（localhost:3000）
  ↓ /api・/sanctum をProxy
Laravel REST API（backend:8000）
  ├── MySQL（mysql:3306）
  └── OpenAI Responses API

phpMyAdmin（localhost:8080）── MySQL
```

SPA認証にはSanctumのCookie・CSRF方式を使用し、セッションはMySQLに保存します。Backendの依存方向は `Controller → Service → Repository → Model` です。OpenAI API KeyはBackendだけで扱います。

## ディレクトリ構成

```text
.
├── frontend/       # Reactアプリケーション
├── backend/        # Laravel API
├── docker/         # Dockerfile・Backend起動スクリプト
├── docs/           # 機能仕様・設計・検証資料
├── compose.yml     # 開発用4サービスの定義
├── .env.example    # Compose用の環境変数定義
└── README.md
```

Frontendは役割別に整理しています。

```text
frontend/src/
├── api/            # 共通API client・ドメイン別API通信
├── pages/          # Routeから表示する画面
├── components/     # 画面を構成するComponent
├── contexts/       # 認証Context・Provider
├── hooks/          # 共通Hook
├── types/          # 型定義・関連する表示処理
├── tests/          # API・画面テストとセットアップ
└── assets/         # 静的アセット
```

Backendの主要な処理は `backend/app/`、APIルートは `backend/routes/api.php`、Schemaは `backend/database/migrations/`、自動テストは `backend/tests/` にあります。

## 環境構築

Docker Engine（Docker Desktop等）とDocker Compose v2が必要です。依存パッケージはコンテナ内でインストールするため、ホストへのNode.js・PHP・Composerのインストールは不要です。

Repository rootで、初回のみ環境変数ファイルを用意します。既存の `.env` がある場合は、その設定を使用してください。

```sh
cp .env.example .env
cp backend/.env.example backend/.env
```

| 設定ファイル | 設定する項目 |
| --- | --- |
| `.env` | `MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`。パスワードをローカル用の値に変更する |
| `backend/.env` | AI翻訳を使用する場合に `OPENAI_API_KEY` を設定する |

ComposeがBackendへMySQL接続設定を渡します。`backend/.env` がない場合は起動スクリプトが例示ファイルから作成し、未設定の `APP_KEY` を生成します。既存の `APP_KEY` は保持します。

OpenAI API Keyが未設定でも、認証・Project・Script・Segment管理と手動翻訳は利用できます。Secretは未追跡の環境変数ファイルで管理し、ブラウザーへ公開される `VITE_` 変数へ入れないでください。

Frontendの通信設定はComposeで `VITE_API_BASE_URL=/api`、`API_PROXY_TARGET=http://backend:8000` としています。項目の説明は `frontend/.env.example` にあります。Dockerで起動する場合、Frontend用 `.env` の作成は不要です。

## 起動方法

Repository rootから実行します。

```sh
docker compose up -d --build
docker compose ps
```

MySQLの正常起動後にBackend、続いてFrontendが起動します。依存関係はlockfileに従ってインストールされます。各サービスが起動したら、初回およびMigration追加時に次を実行します。

```sh
docker compose exec backend php artisan migrate --no-interaction
```

Migrationは自動実行されません。通常の起動ではSeeder・Factory・テストデータを投入しません。新規DBはMigration履歴を除いて空の状態から開始します。アプリを使うアカウントは、利用開始時に `/register` で登録できます。

起動確認には、DBへデータを書き込まないHealth APIを使用します。

```sh
curl --fail http://localhost:8000/api/health
curl --fail http://localhost:3000/api/health
```

正常時は `{"status":"ok","database":"connected"}` を返します。

ソースコードはbind mountで共有し、FrontendはViteのHMRで変更を反映します。`backend/.env` を変更した場合は次のコマンドで再起動します。Composeの環境変数やDockerfileを変更した場合は `docker compose up -d --build` で再作成します。

```sh
docker compose restart backend
```

通常の停止には `docker compose down` を使用します。MySQLデータは `mysql_data` Volumeに保持されます。`docker compose down --volumes` はDBを含む管理Volumeを削除するため、データを保持する通常の停止には使用しません。既に初期化したMySQLのパスワードは、`.env` を変更するだけでは更新されません。

## アクセスURL

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API base | http://localhost:8000/api |
| phpMyAdmin | http://localhost:8080 |
| Health Check | http://localhost:8000/api/health |
| Frontend経由のHealth Check | http://localhost:3000/api/health |

認証を利用する際は、同じホスト名 `localhost` を使用してください。公開ポートはローカルループバックに限定され、MySQLの3306はホストへ公開していません。

phpMyAdminの接続先は `mysql:3306` です。ルート `.env` に設定したMySQLアカウントでログインし、`MYSQL_DATABASE` のDBを選択します。

## 機能一覧

### Authentication

- ユーザー登録、ログイン、ログアウト、再読み込み時のセッション復元。
- 認証済みユーザーの画面保護、所有者によるデータアクセス制御。

### Project Management

- Projectの作成・編集・削除・一覧・詳細、Statusとアーカイブ表示の管理。
- 顧客名、説明、翻訳スタイル、翻訳ルール、契約単価・通貨の設定。
- 詳細画面で「API利用料」を表示。再生成を含む保存済みAI Generationの算出可能な料金を合計し、料金不明の件数も表示。
- 作成・編集画面で1 USDあたりの円レートを手入力。保存した最新のレートで過去分を含むUSD合計を円換算し、`USD 金額（円換算額円）` の形式で表示。未設定時はUSDのみ表示。

### Script Management

- Project配下のScript作成・編集・削除・一覧・詳細。
- タイトル、納期、Status、原文語数、進捗、見込額の管理。
- 作成時のProject単価・通貨を保持し、Segment登録後は原文から語数を再計算。

### Segment Management

- Script配下のSegment作成・編集・削除・一覧。
- 表示順、Timecode、Emotion / Direction、Source Text、Final Translation、メモ、Statusの管理。
- `version` による更新競合の検出と、`source_version` による原文・演出等の変更追跡。古い原文に対応する候補・最終訳を識別。

Project・Script・Segmentの削除は論理削除です。

### Translation Editor

- Segment単位で英文原文と日本語の最終訳を並べて表示。
- 原文・設定はSegment編集画面で、日本語の最終訳・メモはエディターで編集・保存。
- 「完了にする」「再開」による進捗管理と、未保存変更の表示・移動時の確認。

Project詳細からScriptを開き、「翻訳エディターを開く」で `/projects/:projectId/scripts/:scriptId/editor` に進みます。

### AI Translation

- OpenAI Responses APIによるSegment単位の翻訳候補生成、モデル選択、再生成。
- AI Generation履歴、生成時の指示・文脈の参照、候補からFinal Translationへの採用。
- 入力・出力・合計Token Usageとキャッシュ使用量の記録・表示。
- 生成時の料金定義（Price Snapshot）を保存し、使用量に基づいてAPI Costを計算。必要な情報が不足する場合は料金不明として扱う。
- 生成・再生成ではFinal Translationを維持。採用時に最終訳として保存し、手動修正と完了操作へ進む。通信失敗時の自動再送は行わない。

### Translation Context

- Project Translation Style、Translation Rules、SegmentのEmotion / Direction。
- Project単位のGlossaryの登録・編集・削除・一覧。原文に一致する用語を翻訳指示へ反映。
- 同じScriptのPrevious / Next Segmentを参考文脈として使用し、現在のSegmentだけを翻訳。
- 同じScript内で現在のSegmentより前にある、保存済みFinal Translationを直近最大3件、文体・表現の参考として使用。
- 生成時のGlossaryとSegment ContextのSnapshotを保存し、履歴から参照。

## AI翻訳の基本フロー

```text
Source Text
  ↓
Context / Glossary
  ↓
OpenAI Responses API
  ↓
AI Translation Candidate
  ↓
User Review・採用
  ↓
Final Translation・手動編集・保存
  ↓
完了
```

AI候補を生成しただけではFinal Translationは上書きされません。ユーザーが内容を確認して採用するか、手入力で最終訳を作成します。採用後も編集でき、最終確認後に「完了にする」を操作します。




# Translation AI Manager — English

## Overview

A personal web application that supports English-to-Japanese translation work commissioned through platforms such as Upwork. It is designed for localizing English scripts, including YouTube scripts, into natural spoken Japanese.

The application generates translation candidates using the OpenAI API (ChatGPT / OpenAI models). The user reviews, adopts, and edits them to produce the final translation. The workflow centers on AI-generated candidates followed by human review and revision.

## System Stack

Versions below are the major versions established by dependency manifests and Docker configuration. Exact dependency versions are pinned in `frontend/package-lock.json` and `backend/composer.lock`.

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7 |
| Backend | Laravel 13, PHP 8.3, Laravel Sanctum 4, Laravel HTTP Client, BCMath |
| Database | MySQL 8.4 |
| AI | OpenAI Responses API, called by the Backend |
| Development | Docker, Docker Compose v2, Node.js 24, Composer 2, phpMyAdmin 5.2 |
| Testing and quality | Vitest, Testing Library, jsdom, ESLint, PHPUnit, Mockery, Laravel Pint |

The models enabled for selection in the application are `gpt-6-luna` (the default), `gpt-6.1-sol`, and `gpt-6-sol`. Model availability within the app, generation settings, and pricing definitions are managed in `backend/config/ai.php`.

## Architecture

```text
Browser
  ↓
React Frontend / Vite (localhost:3000)
  ↓ Proxy /api and /sanctum
Laravel REST API (backend:8000)
  ├── MySQL (mysql:3306)
  └── OpenAI Responses API

phpMyAdmin (localhost:8080) ── MySQL
```

SPA authentication uses Sanctum cookies and CSRF protection, with sessions stored in MySQL. Backend dependencies follow `Controller → Service → Repository → Model`. Only the Backend handles the OpenAI API Key.

## Directory Structure

```text
.
├── frontend/       # React application
├── backend/        # Laravel API
├── docker/         # Dockerfiles and Backend entrypoint
├── docs/           # Feature specifications, design, and verification documents
├── compose.yml     # Four development services
├── .env.example    # Compose environment variable definitions
└── README.md
```

Frontend code is organized by role.

```text
frontend/src/
├── api/            # Shared API client and domain API calls
├── pages/          # Components rendered by routes
├── components/     # Components that make up pages
├── contexts/       # Authentication Context and Provider
├── hooks/          # Shared hooks
├── types/          # Type definitions and related display helpers
├── tests/          # API and page tests, plus setup
└── assets/         # Static assets
```

Backend application logic is in `backend/app/`, API routes in `backend/routes/api.php`, schema definitions in `backend/database/migrations/`, and automated tests in `backend/tests/`.

## Environment Setup

Docker Engine, such as Docker Desktop, and Docker Compose v2 are required. Dependencies are installed inside containers; Node.js, PHP, and Composer are not required on the host.

From the repository root, prepare environment files once for an initial setup. Use existing `.env` settings if the files are already present.

```sh
cp .env.example .env
cp backend/.env.example backend/.env
```

| Configuration file | Settings |
| --- | --- |
| `.env` | Set `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_ROOT_PASSWORD`. Replace passwords with local values |
| `backend/.env` | Set `OPENAI_API_KEY` when using AI translation |

Compose supplies MySQL connection settings to the Backend. If `backend/.env` is absent, the entrypoint copies the example file and generates `APP_KEY` if it is unset. An existing `APP_KEY` is preserved.

Authentication, Project / Script / Segment management, and manual translation work without an OpenAI API Key. Keep secrets in untracked environment files and out of browser-visible `VITE_` variables.

Compose sets `VITE_API_BASE_URL=/api` and `API_PROXY_TARGET=http://backend:8000`. `frontend/.env.example` describes these settings. A Frontend `.env` file is not needed when running through Docker.

## Starting the Application

Run from the repository root.

```sh
docker compose up -d --build
docker compose ps
```

The Backend starts after MySQL becomes healthy, followed by the Frontend. Dependencies are installed according to the lockfiles. Once services are running, apply migrations on the first setup and whenever migrations are added.

```sh
docker compose exec backend php artisan migrate --no-interaction
```

Migrations do not run automatically. Normal startup does not run seeders, factories, or insert test data. A new database starts empty except for migration records. Register an account through `/register` when you begin using the application.

Use the Health API to verify startup without writing database records.

```sh
curl --fail http://localhost:8000/api/health
curl --fail http://localhost:3000/api/health
```

A healthy response is `{"status":"ok","database":"connected"}`.

Source code is shared through bind mounts; the Frontend uses Vite HMR to reflect changes. After changing `backend/.env`, restart the Backend with the command below. Recreate containers with `docker compose up -d --build` after changing Compose environment variables or Dockerfiles.

```sh
docker compose restart backend
```

Use `docker compose down` for a normal shutdown. MySQL data persists in the `mysql_data` volume. `docker compose down --volumes` deletes managed volumes, including the database, and is not used for a shutdown that preserves data. Changing `.env` alone does not update passwords in an already initialized MySQL instance.

## Access URLs

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API base | http://localhost:8000/api |
| phpMyAdmin | http://localhost:8080 |
| Health Check | http://localhost:8000/api/health |
| Health Check through the Frontend | http://localhost:3000/api/health |

Use the same hostname, `localhost`, for authentication. Published ports bind to the local loopback interface; MySQL port 3306 is not published to the host.

phpMyAdmin connects to `mysql:3306`. Log in using the MySQL account configured in the root `.env`, then select the database specified by `MYSQL_DATABASE`.

## Features

### Authentication

- Registration, login, logout, and session restoration after a page reload.
- Protected authenticated pages and ownership checks for data access.

### Project Management

- Create, edit, delete, list, and view Projects; manage status and archived visibility.
- Configure client name, description, translation style, translation rules, contract rate, and currency.
- Display API usage cost on the detail page. Sum calculable costs for saved AI Generations, including regenerations, and show the number with unknown costs.
- Enter a JPY-per-USD rate in the create / edit form. The latest saved rate converts the USD total, including past usage, into yen. Display the USD amount followed by its yen equivalent in parentheses; show USD only when no rate is set.

### Script Management

- Create, edit, delete, list, and view Scripts within a Project.
- Manage title, deadline, status, source word count, progress, and estimated payment.
- Preserve the Project rate and currency at creation; recalculate word count from source text after Segments are added.

### Segment Management

- Create, edit, delete, and list Segments within a Script.
- Manage sequence, timecodes, emotion / direction, Source Text, Final Translation, memo, and status.
- Detect conflicting updates with `version` and track source / direction changes with `source_version`. Identify candidates and final translations tied to an older source version.

Projects, Scripts, and Segments use soft deletion.

### Translation Editor

- Display English source text and the Japanese final translation side by side for each Segment.
- Edit source text and settings in the Segment form; edit and save the final translation and memo in the editor.
- Manage progress through completion and reopening, with unsaved-change indicators and navigation confirmations.

Open a Script from the Project detail page and follow its translation-editor link to `/projects/:projectId/scripts/:scriptId/editor`.

### AI Translation

- Generate translation candidates per Segment through the OpenAI Responses API, select a model, and regenerate candidates.
- View AI Generation history, generation instructions and context, and adopt candidates as Final Translation.
- Record and display input, output, total Token Usage, and cache usage.
- Store generation-time pricing definitions as a Price Snapshot and calculate API Cost from usage. Mark costs as unknown when required information is missing.
- Preserve Final Translation during generation and regeneration. Adoption saves the final translation, followed by manual editing and completion. Failed requests are not automatically retried.

### Translation Context

- Project Translation Style, Translation Rules, and Segment emotion / direction.
- Create, edit, delete, and list Project Glossary entries. Include terms matching the source text in translation instructions.
- Use the Previous / Next Segment within the same Script as reference context, while translating only the current Segment.
- Reference up to three recent saved Final Translations preceding the current Segment in the same Script for tone and wording.
- Save Glossary and Segment Context snapshots at generation time and make them available in history.

## Basic AI Translation Workflow

```text
Source Text
  ↓
Context / Glossary
  ↓
OpenAI Responses API
  ↓
AI Translation Candidate
  ↓
User Review and Adoption
  ↓
Final Translation, Manual Editing, and Saving
  ↓
Completion
```

Generating an AI candidate does not overwrite Final Translation. The user reviews and adopts a candidate or writes the final translation manually. Adopted translations remain editable; the user marks the Segment complete after the final review.
