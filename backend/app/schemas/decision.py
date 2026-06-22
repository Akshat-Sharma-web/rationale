from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator


DecisionStatus = Literal["draft", "active", "superseded", "archived", "reviewed"]


# â”€â”€ Alternatives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class AlternativeCreate(BaseModel):
    title: str
    description: str = ""
    pros: list[str] = []
    cons: list[str] = []
    is_selected: bool = False

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Alternative title must not be empty")
        return v.strip()


class AlternativeResponse(BaseModel):
    id: str
    decision_id: str
    title: str
    description: str
    pros: list[str]
    cons: list[str]
    is_selected: bool


# â”€â”€ Outcome Reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class OutcomeReviewCreate(BaseModel):
    actual_outcome: str
    quality_score: int  # 1â€“5
    lessons_learned: Optional[str] = None

    @field_validator("quality_score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("quality_score must be between 1 and 5")
        return v

    @field_validator("actual_outcome")
    @classmethod
    def outcome_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("actual_outcome must not be empty")
        return v.strip()


class OutcomeReviewResponse(BaseModel):
    id: str
    decision_id: str
    actual_outcome: str
    quality_score: int
    lessons_learned: Optional[str]
    reviewed_at: datetime
    reviewed_by: str  # user_id of the reviewer


# â”€â”€ Created-by user info embedded in response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class CreatedByUser(BaseModel):
    id: str
    name: str
    email: str


# â”€â”€ Decision request schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DecisionCreate(BaseModel):
    title: str
    context: str = ""
    selected_alternative: Optional[str] = None  # alt UUID; usually set after creation
    rationale: str = ""
    status: DecisionStatus = "draft"
    tags: list[str] = []
    stakeholders: list[str] = []
    review_date: Optional[datetime] = None
    alternatives: list[AlternativeCreate] = []

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title must not be empty")
        return v.strip()


class DecisionUpdate(BaseModel):
    """All fields are optional â€” only provided fields are updated."""
    title: Optional[str] = None
    context: Optional[str] = None
    selected_alternative: Optional[str] = None
    rationale: Optional[str] = None
    status: Optional[DecisionStatus] = None
    tags: Optional[list[str]] = None
    stakeholders: Optional[list[str]] = None
    alternatives: Optional[list[AlternativeCreate]] = None
    review_date: Optional[datetime] = None


# â”€â”€ Decision filter query params â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DecisionFilters(BaseModel):
    status: Optional[DecisionStatus] = None
    tag: Optional[str] = None
    creator_id: Optional[str] = None
    keyword: Optional[str] = None  # searches title + context


# â”€â”€ Decision response schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DecisionResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    context: str
    selected_alternative: Optional[str]
    rationale: str
    status: DecisionStatus
    tags: list[str]
    stakeholders: list[str]
    review_date: Optional[datetime]
    created_at: datetime
    created_by: CreatedByUser
    alternatives: list[AlternativeResponse]
    outcome_reviews: list[OutcomeReviewResponse] = []
