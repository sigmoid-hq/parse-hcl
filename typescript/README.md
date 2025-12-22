# TypeScript Terraform Parser

Terraform HCL 블록을 TypeScript로 파싱하기 위한 경량 파서입니다. 단일 파일 또는 디렉토리(`.tf`만, 서브디렉토리 제외)를 대상으로 주요 Terraform 블록(resource, variable, output, module, provider, data, terraform, locals)을 추출하고 JSON/YAML 형태로 직렬화할 수 있습니다.

## 주요 특징
- 최상위 블록 스캔 후 블록 종류별 파서로 분리 처리
- 리소스/데이터/모듈/프로바이더/테라폼 설정/로컬/변수/출력 파싱 지원
- moved/import/check/terraform_data/unknown 블록 감지
- tfvars/tfstate/tfplan(JSON), tfvars.json, tf.json 파싱 지원
- JSON/YAML 직렬화 시 비어 있는 컬렉션/객체는 기본 생략(prune), `pruneEmpty:false`로 전체 출력 가능
- 의존성 그래프 export 지원
- 디렉토리 파싱 시 파일별 결과와 통합 결과를 선택적으로 반환

## 사용 방법
1) 의존성 설치 및 빌드
```bash
cd typescript
yarn install
yarn build
```

2) 코드에서 사용
```ts
import {
  TerraformParser,
  toJson,
  toYamlDocument,
  toJsonExport,
  buildDependencyGraph,
  TfVarsParser,
  TfStateParser,
  TfPlanParser
} from './dist';

const parser = new TerraformParser();
const single = parser.parseFile('examples/main.tf');
console.log(toJson(single)); // pruneEmpty 기본 적용
console.log(toYamlDocument(single));
console.log(toJsonExport(single)); // { version, document, graph }
console.log(buildDependencyGraph(single));

const dirResult = parser.parseDirectory('examples', { aggregate: true, includePerFile: true });
console.log(dirResult.combined);      // 통합 결과
console.log(dirResult.files[0].path); // 파일별 결과

// 다른 Terraform 아티팩트 파싱
const tfvars = new TfVarsParser().parseFile('examples/variables.auto.tfvars');
const state = new TfStateParser().parseFile('terraform.tfstate');
const plan = new TfPlanParser().parseFile('plan.json'); // terraform show -json 출력

// tf.json 파싱
const jsonDoc = parser.parseFile('examples/config.tf.json');
console.log(toJson(jsonDoc, { pruneEmpty: false })); // 빈 컬렉션 포함 출력
```

3) 예제 실행 및 결과 확인
```bash
cd typescript
yarn example
# ./output/combined.json, ./output/combined.yaml 등으로 샘플 파싱 결과 생성
```

4) CLI 빠르게 사용하기
```bash
cd typescript
yarn cli --file examples/main.tf --format json
yarn cli --dir examples/terraform --graph --format yaml
yarn cli --file examples/vars.auto.tfvars.json --format json --no-prune
```

## 파싱 규칙 메모
- 블록 스캔 시 문자열/주석을 고려해 중괄호를 밸런싱하여 본문을 확보합니다.
- 블록 내부는 상위 레벨의 `key = value` 할당과 중첩 블록을 구분하여 `attributes`와 `blocks`로 분리합니다.
- 값은 문자열/숫자/불리언/배열/오브젝트/표현식으로 분류해 `kind`, `raw`, `value` 필드에 담습니다. 복잡한 표현식은 `raw` 그대로 유지합니다.

## 디렉토리 파싱 옵션
- `aggregate` (기본값: `true`): 모든 파일 결과를 합쳐 단일 `TerraformDocument`로 반환합니다.
- `includePerFile` (기본값: `true`): 파일별 파싱 결과 배열을 함께 반환합니다.
