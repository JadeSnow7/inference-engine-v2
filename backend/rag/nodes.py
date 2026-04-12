from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np


class NodeType(str, Enum):
    PAPER = "paper"
    CONCEPT = "concept"
    METHOD = "method"
    GAP = "research_gap"
    DOMAIN = "domain"


@dataclass
class PaperNode:
    id: str
    title: str
    year: int
    abstract: str
    embedding: Optional[np.ndarray] = None
    cited_by: list[str] = field(default_factory=list)


@dataclass
class ConceptNode:
    id: str
    name: str
    domain: str
    embedding: Optional[np.ndarray] = None
    frequency: int = 0


@dataclass
class ResearchGapNode:
    id: str
    description: str
    severity: str = "medium"
    embedding: Optional[np.ndarray] = None
    year_identified: int = 0


@dataclass
class MethodNode:
    id: str
    name: str
    category: str
    first_year: int = 0
    embedding: Optional[np.ndarray] = None


@dataclass
class DomainNode:
    id: str
    name: str
    field: str
