<?php

namespace App\Http\Controllers;

use App\Http\Requests\ScriptRequest;
use App\Http\Resources\ScriptResource;
use App\Services\ScriptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ScriptController extends Controller {
    public function __construct(private ScriptService $scripts) {}

    public function index(Request $request, int $project): AnonymousResourceCollection {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return ScriptResource::collection($this->scripts->list($request->user(), $project));
    }

    public function store(ScriptRequest $request, int $project): JsonResponse {
        return (new ScriptResource($this->scripts->create($request->user(), $project, $request->validated())))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $project, int $script): ScriptResource {
        return new ScriptResource($this->scripts->show($request->user(), $project, $script));
    }

    public function update(ScriptRequest $request, int $project, int $script): ScriptResource {
        return new ScriptResource($this->scripts->update($request->user(), $project, $script, $request->validated()));
    }

    public function destroy(Request $request, int $project, int $script): Response {
        $this->scripts->delete($request->user(), $project, $script);

        return response()->noContent();
    }
}
