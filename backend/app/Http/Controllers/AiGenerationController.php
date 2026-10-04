<?php

namespace App\Http\Controllers;

use App\Http\Requests\AiTranslateRequest;
use App\Http\Requests\SelectAiGenerationRequest;
use App\Http\Resources\AiGenerationResource;
use App\Http\Resources\SegmentResource;
use App\Services\AiModelCatalog;
use App\Services\AiTranslationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AiGenerationController extends Controller {
    public function __construct(private AiTranslationService $translations, private AiModelCatalog $models) {}

    public function models(): JsonResponse {
        return response()->json($this->models->listing());
    }

    public function store(AiTranslateRequest $request, int $project, int $script, int $segment): JsonResponse {
        $input = $request->validated();
        $result = $this->translations->generate($request->user(), $project, $script, $segment, $input['model'], $input['version'] ?? null);

        return response()->json([
            'translation' => $result['translation'], 'generation' => new AiGenerationResource($result['generation']),
            'segment' => new SegmentResource($result['segment']), 'applied' => $result['applied'],
        ], 201);
    }

    public function index(Request $request, int $project, int $script, int $segment): AnonymousResourceCollection {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return AiGenerationResource::collection($this->translations->history($request->user(), $project, $script, $segment));
    }

    public function select(SelectAiGenerationRequest $request, int $project, int $script, int $segment, int $generation): SegmentResource {
        return new SegmentResource($this->translations->select($request->user(), $project, $script, $segment, $generation, $request->validated('version')));
    }
}
