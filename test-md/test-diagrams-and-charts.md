# 图表与流程图测试 (Mermaid)

## 流程图 (Flowchart)
```mermaid
graph TD
    A[开始] --> B{条件};
    B -->|是| C[操作A];
    B -->|否| D[操作B];
    C --> E[结束];
    D --> E;
```

## 时序图 (Sequence Diagram)
```mermaid
sequenceDiagram
    participant User
    participant Server
    User->>Server: 请求
    Server-->>User: 响应
```

## 甘特图 (Gantt Chart)
```mermaid
gantt
    title 项目计划
    dateFormat YYYY-MM-DD
    section 核心开发
    任务: 2024-01-01, 7d
```

## 饼图 (Pie Chart)
```mermaid
pie
    title 市场份额
    "A" : 45
    "B" : 25
    "C" : 30
```

## 类图 (Class Diagram)
```mermaid
classDiagram
    class Animal {
      +makeSound()
    }
    class Dog {
      +bark()
    }
    Animal <|-- Dog
```

## 状态图 (State Diagram)
```mermaid
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 处理中
    处理中 --> [*]
```

## 实体关系图 (ER Diagram)
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string name
    }
    ORDER {
        int orderID
    }
```

## Git 图 (Git Graph)
```mermaid
gitGraph
    commit
    branch develop
    checkout develop
    commit
    checkout main
    merge develop
```

## 思维导图 (Mindmap)
```mermaid
mindmap
  root((核心))
    分支1
    分支2
```
