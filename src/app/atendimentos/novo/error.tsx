"use client";
import PageError from "../../../components/page-error";
export default function ErrorPage({reset}:{reset:()=>void}) { return <PageError active="Atendimentos" reset={reset}/>; }
