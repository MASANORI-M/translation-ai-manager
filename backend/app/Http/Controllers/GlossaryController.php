<?php

namespace App\Http\Controllers;

use App\Http\Requests\GlossaryRequest;
use App\Http\Resources\GlossaryResource;
use App\Services\GlossaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class GlossaryController extends Controller {
    public function __construct(private GlossaryService $glossaries) {}

    public function index(Request $request, int $project): AnonymousResourceCollection {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return GlossaryResource::collection($this->glossaries->list($request->user(), $project));
    }

    public function store(GlossaryRequest $request, int $project): JsonResponse {
        return (new GlossaryResource($this->glossaries->create($request->user(), $project, $request->validated())))->response()->setStatusCode(201);
    }

    public function update(GlossaryRequest $request, int $project, int $glossary): GlossaryResource {
        return new GlossaryResource($this->glossaries->update($request->user(), $project, $glossary, $request->validated()));
    }

    public function destroy(Request $request, int $project, int $glossary): Response {
        $this->glossaries->delete($request->user(), $project, $glossary);

        return response()->noContent();
    }
}
