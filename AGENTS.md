## Common Instructions
- 사용자와 대화 시에는 한국어를 사용한다. 단, 코드, 주석은 영어로 작성한다.
- README.md 등 Markdown 문서 작성 시, 언어는 사용자가 지정한 언어로 작성하나, 이미 작성된 내용이 있다면 해당 언어를 따른다.
- 사용자가 명시적으로 요청 시에는 해당 언어를 사용한다.
- Tab size는 각 언어 별 설정을 따른다.
- 패키지 설치 시 특정 버전이 필요한 경우 사용자가 명시적으로 요청하지 않는 한 최신 안정 버전을 사용한다.
- 코드는 가능한 한 최신 문법과 기능을 사용한다.
- 하나의 파일에 모든 코드를 작성하지 않는다. 적절히 파일 및 디렉토리 분리를 수행한다.

## Language-Specific Instructions

### Typescript / Yarn
- 패키지 매니저는 Yarn을 사용한다.
- package.json을 직접 수정하는 것을 엄격히 금지하며, yarn add/remove 명령어를 통한 패키지 설치/제거만 허용된다.
- 단, 실행 script 추가, name, version, author 설정 등 민감하지 않은 작업에 대해서는 직접 수정이 허용된다.
- 코드 실행은 yarn <script> 형태로 한다.
- Tab size는 4로 설정한다.

### Python / UV
- 패키지 매니저로 uv를 사용한다.
- pip 명령어를 사용하거나, 직접 requirements.py나 pyproject.toml을 직접 수정하지 않는다.
- uv add, remove 등 명령어를 사용하여 패키지를 추가/제거하라.
- 코드 실행은 uv run으로 해라.
- Tab size는 4로 설정한다.

### Terraform
- Tab size는 2로 설정한다.
- 기본적으로 envs/, keypairs/, modules/ 구조를 가진다.
- locals를 사용하여 중복 코드를 최소화하고, 재사용성을 높인다.

### JSON
- Tab size는 4로 설정한다.

## Framework-Specific Instructions

### React / Next
- 반드시 yarn을 사용한다
- css는 vanilla-extract를 사용한다.
- Tailwind css를 사용하지 않는다.
- 디자인 시스템은 <>를 사용하며, (Optional) 부수적으로 <>를 사용할 수 있다.
- SEO 최적화를 진행하고, OG 등을 반영한다.
- 사용자의 요청이 있을 경우, i18n, next-intl 등을 사용해 다국어 지원이 가능하도록 개발한다.
- 기본적으로 서버 컴포넌트는 lib/ 로 분리하여 관리한다.
- vitest 를 사용하여 테스트 코드를 작성하고, 이를 통해 테스트하여야 한다.

### NestJS
- DBMS는 <MySQL or PostgreSQL>를 사용하며, ORM은 Sequelize를 사용한다.
- 캐시는 Redis를 사용한다.
- 서버 프레임워크는 Nestjs + Typescript를 사용한다.
- 반드시 test 코드를 작성하고, 이를 통해 테스트하여야 한다.
- dto는 모두 class-validator를 통해 검증을 진행하여야 하며, 필요시 class-transformer도 함께 사용한다.
- cors 값은 env 파일에서 관리한다.
- @nestjs/terminus를 통해 health check가 가능하도록 개발한다.

### FastAPI
- DBMS는 <MySQL or PostgreSQL>를 사용하며, ORM은 Tortoise를 사용한다.
- 캐시는 Redis를 사용한다.
- 서버 프레임워크는 FastAPI + Python + UV를 사용한다.
- 반드시 test 코드를 작성하고, 이를 통해 테스트하여야 한다.
- pydantic 모델을 통해 DTO 검증을 진행하여야 한다.
- cors 값은 env 파일에서 관리한다.
- prod 환경에서는 gunicorn을 사용하며, worker 수는 CPU 코어 수 * 2 + 1 로 설정한다.

### AWS CloudFormation (작성 중)
- Tab size는 2로 설정한다.
- 버전/템플릿 룰: AWSTemplateFormatVersion, Description, Metadata 기본; 파라미터 타입, 제약조건 명시, 기본값 최소화, Mappings/Conditions 적극 활용.
- 스택 정책: 생성, 업데이트 정책 필수, UpdateReplacePolicy/DeletionPolicy로 자원 파괴 방지(특히 DB/EFS/S3). Change Set 기반 배포만 허용.
- 파라미터/시크릿: secrets value는 SSM Parameter/Secrets Manager 참조; NoEcho 파라미터, 파라미터 스토어 계층 규칙 정의.
- 기본적으로 모듈화를 진행하며, Nested Stack 구조를 기본적으로 활용한다.

## Part-Specific Instructions

### Frontend part
- Sentry를 설치하고, 에러 로깅이 가능하도록 개발한다.
- 값을 직접 하드코딩하지 않고, 상수화하여 관리한다. 상수화된 값은 .env를 통해 관리하는 것을 우선으로 하나, .env에 값이 존재하지 않을 시 기본값을 사용한다.

### Backend part
- Sentry를 설치하고, 에러 로깅이 가능하도록 개발한다.
- 코드 중복을 최소화하여 개발한다.
- 확장성, 유지보수성, 테스트 가능성을 고려하여 설계한다.
- 모듈화된 구조를 사용한다.
- 기본적으로 발생하는 모든 이벤트에 대해서 로깅을 철저히 수행하여야 하며, timestamp, level, msg, service, env, requestId, userId, method, path, status, latency_ms, ip, userAgent, stack(optional) 등의 값을 포함하여야 한다.
- 로그는 stdout으로 출력한다.
- 값을 절대 하드코딩하지 않고, .env를 통해 관리하는 것을 우선한다.
- health check, liveness probe, readiness probe endpoint를 반드시 구현한다.

### Cloud part(작성 중)
- Snake case를 기본적으로 사용하며, -가 아닌 _를 최우선적으로 사용한다.
- dev/staging/prod 환경으로 구분한다.